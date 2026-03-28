const crypto = require("crypto");
const axios = require("axios");

function backendPublicUrl() {
  const explicit = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT || 3000}`;
}

function callbackRedirectUri() {
  const explicit = process.env.INSTAGRAM_CALLBACK_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return `${backendPublicUrl()}/api/auth/instagram/callback`;
}

function instagramAppId() {
  return process.env.INSTAGRAM_APP_ID || process.env.INSTAGRAM_CLIENT_ID;
}

function instagramAppSecret() {
  return process.env.INSTAGRAM_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET;
}

function isConfigured() {
  return !!(instagramAppId() && instagramAppSecret());
}

/**
 * instagram_business_basic: profesyonel (İşletme / İçerik Üretici) hesap gerekir.
 */
const DEFAULT_SCOPE = "instagram_business_basic";

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: instagramAppId(),
    redirect_uri: callbackRedirectUri(),
    response_type: "code",
    scope: process.env.INSTAGRAM_SCOPE || DEFAULT_SCOPE,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

function parseTokenResponse(body) {
  if (body?.data && Array.isArray(body.data) && body.data[0]) {
    const row = body.data[0];
    return {
      accessToken: row.access_token,
      userId: String(row.user_id),
    };
  }
  if (body?.access_token) {
    return {
      accessToken: body.access_token,
      userId: String(body.user_id),
    };
  }
  return null;
}

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams();
  params.append("client_id", instagramAppId());
  params.append("client_secret", instagramAppSecret());
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", callbackRedirectUri());
  params.append("code", code);

  const { data } = await axios.post(
    "https://api.instagram.com/oauth/access_token",
    params.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 20000,
    }
  );

  const parsed = parseTokenResponse(data);
  if (!parsed?.accessToken || !parsed?.userId) {
    const msg =
      data?.error_message ||
      data?.error?.message ||
      "Instagram jetonu alınamadı";
    throw new Error(msg);
  }
  return parsed;
}

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v21.0";

function parseMeResponse(body) {
  const row =
    body?.data && Array.isArray(body.data) && body.data[0]
      ? body.data[0]
      : body;
  if (!row || (row.user_id == null && row.id == null)) return null;
  const userId =
    row.user_id != null ? String(row.user_id) : String(row.id);
  return {
    id: userId,
    username: row.username || "",
    name: (row.name || row.username || "").trim(),
    accountType: row.account_type || "",
  };
}

async function fetchInstagramProfile(accessToken) {
  const { data } = await axios.get(
    `https://graph.instagram.com/${GRAPH_VERSION}/me`,
    {
      params: {
        fields: "user_id,username,name,account_type",
        access_token: accessToken,
      },
      timeout: 15000,
    }
  );
  return parseMeResponse(data);
}

/** Oturum açma akışı; callback'te JWT ile bağlama state'inden ayırt edilir */
function newOAuthState() {
  return `lg.${crypto.randomBytes(24).toString("hex")}`;
}

module.exports = {
  isConfigured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchInstagramProfile,
  newOAuthState,
  callbackRedirectUri,
};
