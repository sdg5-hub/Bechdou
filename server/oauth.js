// Google / Facebook "Sign in with..." via plain OAuth 2.0 authorization-code
// flow, using fetch — no passport.js or provider SDKs, matching the rest of
// this project's zero-extra-dependency approach.
import crypto from "node:crypto";

const PROVIDERS = {
  google: {
    label: "Google",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: (redirectUri, state) => {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
    async exchange(code, redirectUri) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
      const { access_token } = await res.json();

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!profileRes.ok) throw new Error(`Google profile fetch failed (${profileRes.status})`);
      const profile = await profileRes.json();
      if (!profile.email) throw new Error("Google did not share an email address.");

      return {
        oauthId: profile.sub,
        email: profile.email,
        emailVerified: !!profile.email_verified,
        name: profile.name || profile.email.split("@")[0],
        avatar: profile.picture || null,
      };
    },
  },

  facebook: {
    label: "Facebook",
    clientId: () => process.env.FACEBOOK_APP_ID,
    clientSecret: () => process.env.FACEBOOK_APP_SECRET,
    authorizeUrl: (redirectUri, state) => {
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID,
        redirect_uri: redirectUri,
        state,
        scope: "email,public_profile",
      });
      return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
    },
    async exchange(code, redirectUri) {
      const tokenParams = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams}`);
      if (!res.ok) throw new Error(`Facebook token exchange failed (${res.status})`);
      const { access_token } = await res.json();

      const profileParams = new URLSearchParams({ fields: "id,name,email,picture", access_token });
      const profileRes = await fetch(`https://graph.facebook.com/me?${profileParams}`);
      if (!profileRes.ok) throw new Error(`Facebook profile fetch failed (${profileRes.status})`);
      const profile = await profileRes.json();
      if (!profile.email) throw new Error("Facebook did not share an email address — check the app has the email permission approved.");

      return {
        oauthId: profile.id,
        email: profile.email,
        // Facebook only returns verified email addresses in the first place.
        emailVerified: true,
        name: profile.name || profile.email.split("@")[0],
        avatar: profile.picture?.data?.url || null,
      };
    },
  },
};

export function configuredProviders() {
  return Object.entries(PROVIDERS)
    .filter(([, p]) => p.clientId() && p.clientSecret())
    .map(([id]) => id);
}

export function getProvider(id) {
  const provider = PROVIDERS[id];
  if (!provider || !provider.clientId() || !provider.clientSecret()) return null;
  return provider;
}

/* ---------- CSRF state ----------
   Short-lived, in-memory, single-use. The app has no cookie/session layer to
   piggyback on, so the state round-trips as a plain query param instead. */
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

export function issueState() {
  const state = crypto.randomBytes(24).toString("base64url");
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

export function consumeState(state) {
  const expires = pendingStates.get(state);
  pendingStates.delete(state);
  return !!expires && expires > Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [state, expires] of pendingStates) {
    if (expires <= now) pendingStates.delete(state);
  }
}, 5 * 60 * 1000).unref();
