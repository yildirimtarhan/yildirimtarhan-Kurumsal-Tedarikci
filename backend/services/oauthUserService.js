const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendCustomerToERP } = require("./erpService");

function displayNameFromProfile(profile, email) {
  if (profile.displayName && profile.displayName.trim()) return profile.displayName.trim();
  const given = profile.name?.givenName || "";
  const family = profile.name?.familyName || "";
  const combined = `${given} ${family}`.trim();
  if (combined) return combined;
  return email.split("@")[0];
}

function emailFromProfile(profile) {
  if (profile.emails && profile.emails[0]?.value) {
    return String(profile.emails[0].value).toLowerCase().trim();
  }
  if (profile._json?.email) {
    return String(profile._json.email).toLowerCase().trim();
  }
  return null;
}

/**
 * Google, Facebook veya Instagram profiliyle kullanıcı bulur veya oluşturur.
 * Instagram e-posta vermez; tek hesap için `ig_{id}@oauth-instagram.local` kullanılır.
 */
async function upsertOAuthUser(provider, profile) {
  let email;
  if (provider === "instagram") {
    email = `ig_${String(profile.id).replace(/[^a-zA-Z0-9_]/g, "")}@oauth-instagram.local`;
  } else {
    email = emailFromProfile(profile);
    if (!email) {
      const err = new Error(
        "E-posta alınamadı. Lütfen hesabınızda e-posta paylaşımına izin verin."
      );
      err.code = "OAUTH_NO_EMAIL";
      throw err;
    }
  }

  const idField =
    provider === "google"
      ? "googleId"
      : provider === "facebook"
        ? "facebookId"
        : "instagramId";
  const oauthId = String(profile.id);

  let user = await User.findOne({ [idField]: oauthId });
  if (user) return user;

  user = await User.findOne({ email: email.toLowerCase().trim() });
  if (user) {
    if (user[idField] && String(user[idField]) !== oauthId) {
      const err = new Error(
        "Bu sosyal hesap başka bir üyelikle eşleşmiş. Destek ile iletişime geçin."
      );
      err.code = "OAUTH_ID_CONFLICT";
      throw err;
    }
    user[idField] = oauthId;
    const fromOAuth =
      provider !== "instagram"
        ? displayNameFromProfile(profile, email)
        : profile.displayName?.trim() || user.ad;
    if (fromOAuth && (!user.ad || !String(user.ad).trim())) {
      user.ad = fromOAuth;
    }
    await user.save();
    return user;
  }

  const placeholderPassword = await bcrypt.hash(
    crypto.randomBytes(48).toString("hex"),
    10
  );
  const ad =
    provider === "instagram" && profile.displayName
      ? profile.displayName.trim()
      : displayNameFromProfile(profile, email);

  user = await User.create({
    ad,
    email,
    password: placeholderPassword,
    uyelikTipi: "bireysel",
    rol: "user",
    googleId: provider === "google" ? oauthId : undefined,
    facebookId: provider === "facebook" ? oauthId : undefined,
    instagramId: provider === "instagram" ? oauthId : undefined,
    faturaAdresi: {
      baslik: "Fatura Adresi",
      sehir: "",
      ilce: "",
      acikAdres: "",
    },
    teslimatAdresi: {
      baslik: "Teslimat Adresi",
      adSoyad: ad,
      telefon: "",
      sehir: "",
      ilce: "",
      acikAdres: "",
    },
    addresses: [],
  });

  sendCustomerToERP(user).then((erpResult) => {
    if (erpResult.success) {
      user.erpSynced = true;
      user.erpCariId = erpResult.erpCariId || "";
      user.erpSyncDate = new Date();
      return user.save();
    }
  }).catch(() => {});

  return user;
}

module.exports = { upsertOAuthUser, emailFromProfile };
