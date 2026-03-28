const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User");
const { upsertOAuthUser } = require("../services/oauthUserService");

function backendPublicUrl() {
  const explicit = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT || 3000}`;
}

module.exports = function configurePassport(passport) {
  passport.serializeUser((user, done) => {
    done(null, user._id.toString());
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const callbackURL =
      process.env.GOOGLE_CALLBACK_URL ||
      `${backendPublicUrl()}/api/auth/google/callback`;

    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = await upsertOAuthUser("google", profile);
            done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    const callbackURL =
      process.env.FACEBOOK_CALLBACK_URL ||
      `${backendPublicUrl()}/api/auth/facebook/callback`;

    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL,
          profileFields: ["id", "displayName", "emails"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = await upsertOAuthUser("facebook", profile);
            done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }
};
