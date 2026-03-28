const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../config/jwt");
const instagramOAuth = require("../services/instagramOAuthService");
const { upsertOAuthUser } = require("../services/oauthUserService");

const router = express.Router();

function frontendBase() {
  return (process.env.FRONTEND_URL || "http://127.0.0.1:5500").replace(
    /\/$/,
    ""
  );
}

function issueToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      id: user._id,
      email: user.email,
      rol: user.rol,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function redirectSuccess(res, token, returnPage) {
  const base = frontendBase();
  const page = returnPage || "giris.html";
  res.redirect(`${base}/${page}?oauth_token=${encodeURIComponent(token)}`);
}

function redirectFailure(res, message) {
  const base = frontendBase();
  const q = new URLSearchParams({
    oauth_error: "1",
    message: message || "Giriş başarısız",
  });
  res.redirect(`${base}/giris.html?${q.toString()}`);
}

const googleFail = `${frontendBase()}/giris.html?oauth_error=1`;
const facebookFail = `${frontendBase()}/giris.html?oauth_error=1`;

router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectFailure(res, "Google girişi sunucuda yapılandırılmamış.");
  }
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: true,
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: true,
    failureRedirect: googleFail,
  }),
  (req, res) => {
    try {
      if (!req.user) {
        return redirectFailure(res, "Google oturumu doğrulanamadı.");
      }
      redirectSuccess(res, issueToken(req.user));
    } catch (e) {
      redirectFailure(res, e.message);
    }
  }
);

router.get("/facebook", (req, res, next) => {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return redirectFailure(res, "Facebook girişi sunucuda yapılandırılmamış.");
  }
  passport.authenticate("facebook", {
    scope: ["email"],
    session: true,
  })(req, res, next);
});

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    session: true,
    failureRedirect: facebookFail,
  }),
  (req, res) => {
    try {
      if (!req.user) {
        return redirectFailure(res, "Facebook oturumu doğrulanamadı.");
      }
      redirectSuccess(res, issueToken(req.user));
    } catch (e) {
      redirectFailure(res, e.message);
    }
  }
);

router.post("/instagram/link-token", express.json(), (req, res) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  if (!token) {
    return res.status(401).json({ success: false, message: "Giriş gerekli" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Geçersiz oturum" });
    }
    const state = jwt.sign(
      { ig: "link", sub: String(userId) },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    res.json({ success: true, state });
  } catch {
    res.status(401).json({ success: false, message: "Oturum geçersiz" });
  }
});

router.get("/instagram", (req, res) => {
  if (!instagramOAuth.isConfigured()) {
    return redirectFailure(res, "Instagram girişi sunucuda yapılandırılmamış.");
  }
  if (req.query.ls) {
    try {
      const p = jwt.verify(req.query.ls, JWT_SECRET);
      if (p.ig !== "link" || !p.sub) {
        throw new Error("invalid");
      }
    } catch {
      return redirectFailure(
        res,
        "Instagram bağlantısı geçersiz veya süresi doldu. Profilden tekrar deneyin."
      );
    }
    return res.redirect(instagramOAuth.buildAuthorizeUrl(req.query.ls));
  }
  const state = instagramOAuth.newOAuthState();
  req.session.instagramOAuthState = state;
  res.redirect(instagramOAuth.buildAuthorizeUrl(state));
});

router.get("/instagram/callback", async (req, res) => {
  try {
    if (req.query.error) {
      const desc =
        req.query.error_description ||
        req.query.error_reason ||
        "Instagram erişimi reddedildi.";
      return redirectFailure(res, String(desc).replace(/\+/g, " "));
    }

    let code = req.query.code;
    if (typeof code === "string" && code.includes("#")) {
      code = code.split("#")[0];
    }
    if (!code) {
      return redirectFailure(res, "Yetkilendirme kodu alınamadı.");
    }

    const state = req.query.state;
    if (!state || typeof state !== "string") {
      return redirectFailure(res, "Geçersiz yönlendirme (state).");
    }

    let linkUserId = null;
    if (!state.startsWith("lg.")) {
      try {
        const p = jwt.verify(state, JWT_SECRET);
        if (p.ig === "link" && p.sub) {
          linkUserId = String(p.sub);
        }
      } catch {
        linkUserId = null;
      }
    }

    const { accessToken, userId } = await instagramOAuth.exchangeCodeForToken(
      code
    );
    let profile = null;
    try {
      profile = await instagramOAuth.fetchInstagramProfile(accessToken);
    } catch (_) {
      profile = null;
    }
    const igId = String(profile?.id || userId);

    if (linkUserId) {
      const existingIg = await User.findOne({ instagramId: igId });
      if (existingIg && String(existingIg._id) !== linkUserId) {
        return redirectFailure(
          res,
          "Bu Instagram hesabı başka bir üyelikte kullanılıyor."
        );
      }
      const user = await User.findById(linkUserId);
      if (!user) {
        return redirectFailure(res, "Hesap bulunamadı.");
      }
      user.instagramId = igId;
      await user.save();
      redirectSuccess(res, issueToken(user), "profil.html");
      return;
    }

    if (state !== req.session.instagramOAuthState) {
      return redirectFailure(
        res,
        "Oturum doğrulanamadı. Lütfen Instagram ile girişi tekrar deneyin."
      );
    }
    delete req.session.instagramOAuthState;

    const displayName =
      (profile?.name && profile.name.trim()) ||
      (profile?.username && `@${profile.username}`) ||
      `Instagram ${igId}`;

    const user = await upsertOAuthUser("instagram", {
      id: igId,
      displayName,
    });
    redirectSuccess(res, issueToken(user));
  } catch (e) {
    redirectFailure(res, e.message || "Instagram girişi başarısız.");
  }
});

module.exports = router;
