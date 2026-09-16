# Bechdou — Pakistan's fashion resale marketplace

A full-stack, community resale marketplace for preloved fashion, tuned for
Pakistan's mobile-first, Cash-on-Delivery market. Shop verified seller closets,
request checkout, and sell the pieces you've outgrown — with admin moderation,
order operations, and a real REST API behind it.

- **Frontend** — a cinematic, mobile-first storefront (vanilla HTML/CSS/JS, PWA).
- **Backend** — an Express + SQLite REST API with real auth, roles, listings,
  orders, and image uploads.

---

## ✨ Features

**Storefront (buyer experience)**
- Cinematic hero, trending drops, curated collections, shop-by-category
- Featured **seller closets** with verified badges, followers, trust scores
- Elevated product cards (seller identity, likes, hover quick-actions, skeletons)
- Product **quick-view** with image gallery, buyer trust badges, and WhatsApp deep-link
- Search, filters (city / condition / price / sort) and "saved" closet
- Installable **PWA** (manifest + service worker + "Add to Homescreen")
- Mobile sticky bottom nav, scroll-reveal animations, `prefers-reduced-motion`

**Marketplace engine**
- **Auth & roles** — buyer / seller / admin, scrypt-hashed passwords, JWT sessions
- **Google / Facebook sign-in**, optional — hidden until credentials are configured
- Any buyer can **become a seller** in one click, free
- **Sellers** submit listings (with photo upload) for review
- **Admins** approve / reject listings and run the order desk
- **Orders** — pay Bechdou directly via JazzCash, EasyPaisa, or bank transfer, then QC → dispatch → delivered
- **Commission** — Bechdou keeps 20% of each sale; admin sees exactly what to send each seller
- **Saves/likes**, marketplace pulse (GMV, metrics), activity feed, audit log
- Role-scoped data: buyers see their own orders, admins see everything

---

## 🧱 Tech stack

| Layer     | Choice                                                            |
|-----------|------------------------------------------------------------------|
| Frontend  | Vanilla HTML / CSS / JS (no build step), PWA                     |
| Backend   | Node.js + Express                                                |
| Database  | SQLite via Node's built-in `node:sqlite` (no native compilation) |
| Auth      | `node:crypto` — scrypt password hashing + HS256 tokens          |
| Deps      | **`express` is the only npm dependency**                         |

Designed to be dependency-light and easy to run: SQLite, hashing, tokens, and
image storage all use Node built-ins.

---

## 🚀 Quick start

**Prerequisites:** Node.js **22.5+** (for the built-in `node:sqlite` module).
Check with `node -v`.

```bash
# 1. Install the one backend dependency
cd server
npm install

# 2. Start the server (serves the API + the static frontend together)
npm start

# 3. Open the app
#    → http://localhost:4000
```

That's it. On first run the database (`server/bechdou.db`) is created and seeded
automatically. The server serves the frontend and the `/api/*` endpoints from the
same origin, so there is nothing else to start.

> The frontend now talks to the backend, so open it via **http://localhost:4000**
> — not by double-clicking `index.html` (that has no API to call).

### Demo accounts — local development only

> ⚠️ These exist **only** when the demo seed is on (the default in local dev).
> They are switched off automatically as soon as you set `NODE_ENV=production`
> or `BECHDOU_ADMIN_EMAIL`. Never run a public site with them enabled — the
> password below is published in this file, so anyone reading the repo could
> log in as your admin. See [Before you launch](#-before-you-launch).

All seeded accounts use the password **`bechdou123`**:

| Role   | Email                | Can do                                  |
|--------|----------------------|-----------------------------------------|
| Admin  | `admin@bechdou.pk`   | Approve listings, run orders, reset data |
| Seller | `aiza@example.com`   | List items, manage their closet          |
| Seller | `noor@example.com`   | List items, manage their closet          |
| Buyer  | `mina@example.com`   | Browse, save, checkout via JazzCash/EasyPaisa/bank |

Log in from the **Account** tab (mobile bottom nav) or the **Pulse / Browse**
side panel on desktop. Use **Reset** (as admin) to restore the seed data.

---

## 🗂️ Project structure

```
bechdou-site/
├── index.html            # Storefront markup (views: Home, Browse, Sell, Pulse, Admin)
├── styles.css            # Design system + storefront styles (brand palette locked)
├── script.js             # UI logic + rendering; talks to the API
├── api.js                # Tiny fetch client (token persistence)
├── manifest.webmanifest  # PWA manifest
├── sw.js                 # Service worker (app-shell caching)
├── assets/               # Images + app icon
└── server/
    ├── index.js          # Express app: routes + static serving
    ├── db.js             # node:sqlite schema, seed, queries
    ├── auth.js           # scrypt hashing + HS256 tokens
    ├── package.json      # start script (uses --experimental-sqlite)
    └── uploads/          # uploaded listing images (runtime)
```

---

## 🔌 API reference

All responses are JSON. Authenticated requests send `Authorization: Bearer <token>`.

| Method | Endpoint                        | Auth      | Purpose                              |
|--------|---------------------------------|-----------|--------------------------------------|
| GET    | `/api/bootstrap`                | optional  | Hydrate the app (role-scoped data)   |
| POST   | `/api/auth/signup`              | —         | Create account → `{ token, account }`|
| POST   | `/api/auth/login`               | —         | Log in → `{ token, account }`        |
| GET    | `/api/auth/me`                  | optional  | Current account                      |
| GET    | `/api/auth/:provider`           | —         | Start Google/Facebook sign-in (browser redirect) |
| GET    | `/api/auth/:provider/callback`  | —         | Provider redirects here; hands off to `#oauth-callback` |
| PATCH  | `/api/profile`                  | any user  | Update name, bio, username, phone, city, avatar |
| POST   | `/api/profile/become-seller`    | any user  | One-click buyer → seller upgrade     |
| GET    | `/api/sellers/:handle`          | —         | Public closet (seller + listings)    |
| GET    | `/api/listings`                 | —         | Approved listings (filter/search)    |
| GET    | `/api/listings/:id`             | —         | One listing (counts a view)          |
| POST   | `/api/listings`                 | seller    | Create listing (base64 image upload) |
| PATCH  | `/api/listings/:id`             | owner/admin | Edit a listing                     |
| DELETE | `/api/listings/:id`             | owner/admin | Delete a listing (blocked mid-order) |
| POST   | `/api/listings/:id/sold`        | owner/admin | Mark sold / available              |
| POST   | `/api/listings/:id/approve`     | admin     | Approve a listing                    |
| POST   | `/api/listings/:id/reject`      | admin     | Reject a listing                     |
| POST   | `/api/listings/:id/save`        | any user  | Toggle save/like                     |
| POST   | `/api/orders`                   | any user  | Checkout (JazzCash/EasyPaisa/bank + reference) |
| GET    | `/api/orders`                   | any user  | Orders (scoped by role)              |
| POST   | `/api/orders/:id/cancel`        | buyer     | Cancel own order before dispatch     |
| POST   | `/api/orders/:id/ship`          | seller/admin | Mark the order shipped            |
| POST   | `/api/orders/:id/status`        | admin     | `paid` (confirm payment) / `qc` / `dispatch` / `delivered` / `cancel` |
| POST   | `/api/orders/:id/payout`        | admin     | Mark seller payout sent/unsent       |
| GET    | `/api/accounts`                 | admin     | All accounts                         |
| POST   | `/api/accounts/:id/suspend`     | admin     | Suspend / reinstate a user           |
| POST   | `/api/reset`                    | admin     | Restore seed data (**demo mode only**) |

### Example

```bash
# Log in and approve a listing
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@bechdou.pk","password":"bechdou123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s -X POST localhost:4000/api/listings/lst-pending-bag/approve \
  -H "Authorization: Bearer $TOKEN"
```

---

## ⚙️ Configuration

Environment variables (all optional):

| Variable             | Default                | Notes                            |
|----------------------|------------------------|----------------------------------|
| `PORT`               | `4000`                 | HTTP port                        |
| `NODE_ENV`           | —                      | Set to `production` on the live server — turns the demo seed off |
| `BECHDOU_ADMIN_EMAIL` / `BECHDOU_ADMIN_PASSWORD` | — | **Your** admin account, created on first boot. Setting the email also disables the demo seed |
| `BECHDOU_ADMIN_NAME` | `Bechdou Admin`        | Display name for that account    |
| `BECHDOU_DEMO`       | on in dev, off in prod | `1` forces the demo seed + the "Reset demo data" button back on |
| `BECHDOU_SECRET`     | dev secret             | **Set this in production** (signs tokens) |
| `BECHDOU_DB`         | `server/bechdou.db`    | SQLite file path                 |
| `BECHDOU_SUPPORT_WHATSAPP` | —                | Digits incl. country code. Blank hides the WhatsApp buttons |
| `BECHDOU_SUPPORT_EMAIL`    | —                | Blank hides the email button on Contact |
| `BECHDOU_TRUST_PROXY`      | —                | Set to `1` behind a load balancer, or rate limits apply site-wide |
| `BECHDOU_UPLOADS_DIR`      | `server/uploads` | Put on the persistent disk in production |
| `RESEND_API_KEY`     | —                      | Enables real email delivery      |
| `BECHDOU_FROM_EMAIL` | `onboarding@resend.dev`| Sender address on outgoing email |
| `BECHDOU_APP_URL`    | `http://localhost:4000`| Base URL used in email links     |
| `JAZZCASH_ACCOUNT_TITLE` / `JAZZCASH_ACCOUNT_NUMBER` | placeholder | Shown to buyers at checkout — **set to your real JazzCash details before launch** |
| `EASYPAISA_ACCOUNT_TITLE` / `EASYPAISA_ACCOUNT_NUMBER` | placeholder | Shown to buyers at checkout — **set to your real EasyPaisa details before launch** |
| `BANK_ACCOUNT_TITLE` / `BANK_ACCOUNT_NUMBER` / `BANK_NAME` | placeholder | Shown to buyers at checkout — **set to your real bank details before launch** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Enables "Continue with Google" — hidden if unset |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | — | Enables "Continue with Facebook" — hidden if unset |

To wipe and re-seed, stop the server, delete `server/bechdou.db*`, and restart —
or just hit **Reset** in the UI as admin.

**Payments are manual, not automated.** There is no payment gateway — buyers
send money directly to Bechdou's own JazzCash/EasyPaisa/bank account and enter
the transaction ID at checkout. An admin confirms the payment landed (Orders
tab), then the Payouts tab shows exactly how much of that sale is Bechdou's
20% commission and how much to send the seller.

### Email setup (verification + password reset)

Email uses [Resend](https://resend.com)'s REST API — no npm package required.

1. Create a free Resend account and generate an API key.
2. Verify your sending domain (or use `onboarding@resend.dev` for testing).
3. Set the variables and restart:

```bash
RESEND_API_KEY=re_xxxxxxxx
BECHDOU_FROM_EMAIL="Bechdou <no-reply@yourdomain.pk>"
BECHDOU_APP_URL=https://yourdomain.pk
```

**Without `RESEND_API_KEY` the app still works** — verification and reset links
are printed to the server console instead of being emailed, so you can develop
and test the full flow locally before wiring up a provider.

### Google / Facebook sign-in setup

Both use plain OAuth 2.0 — no SDK, no new dependency. **Without credentials,
the "Continue with Google/Facebook" buttons simply don't render** — nothing
else is affected, so this is entirely optional.

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create an OAuth client ID (type: Web application).
2. Under **Authorized redirect URIs**, add exactly:
   `http://localhost:4000/api/auth/google/callback` for local dev, and your
   real domain's equivalent for production (e.g. `https://bechdou.pk/api/auth/google/callback`).
3. Copy the Client ID and Client Secret into `.env`:

```bash
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
```

**Facebook:**
1. Go to [Meta for Developers](https://developers.facebook.com/apps) → create an app → add the **Facebook Login** product.
2. Under Facebook Login → Settings, add the same callback URL pattern:
   `http://localhost:4000/api/auth/facebook/callback` (and your production domain's equivalent).
3. Copy the App ID and App Secret into `.env`:

```bash
FACEBOOK_APP_ID=xxxxxxxx
FACEBOOK_APP_SECRET=xxxxxxxx
```

**Note:** Facebook restricts new apps to a small list of test users until Meta
reviews the app for public use — expect to submit for review before real
strangers can use "Continue with Facebook."

In both cases the redirect URI you register must match `BECHDOU_APP_URL`
exactly (scheme, host, and path) or the provider will reject the request.

A brand-new sign-in creates a **buyer** account with the email marked
verified (the provider already confirmed it). If an account with that email
already exists, the two are linked instead of creating a duplicate.

---

## 🚦 Before you launch

Work top to bottom. The first four are the ones that actually hurt if skipped.

1. **Create your own admin account.** Set `BECHDOU_ADMIN_EMAIL` and
   `BECHDOU_ADMIN_PASSWORD` in `server/.env`. This also turns the demo seed
   off, so the site starts empty instead of full of Aiza/Noor/Mina test data.
2. **Set `NODE_ENV=production` and `BECHDOU_SECRET`.** Without the secret,
   session tokens are signed with a default that is public in this repo —
   anyone could forge a login. Generate one with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
3. **Put your real payment accounts in `.env`.** `JAZZCASH_*`, `EASYPAISA_*`
   and `BANK_*` are shown to buyers at checkout. They currently default to
   visible placeholders (`0300-0000000`) — a buyer would send money nowhere.
4. **Turn email on.** Set `RESEND_API_KEY` and `BECHDOU_APP_URL`. Without it,
   signup verification and password-reset links are only printed to the server
   console, so **nobody can finish creating an account**.
5. **Serve over HTTPS.** Sessions are bearer tokens; on plain HTTP they are
   readable in transit.
6. **Set your support channels.** `BECHDOU_SUPPORT_WHATSAPP` and
   `BECHDOU_SUPPORT_EMAIL`. Until you do, the Contact page and the "Ask about
   this piece" buttons stay hidden rather than linking somewhere dead.
7. Optional: add `GOOGLE_*` / `FACEBOOK_*` for social sign-in, and replace the
   placeholder Terms and Privacy pages with real ones.
8. **Back up `server/bechdou.db`.** It holds every account, listing and order.
   Uploaded photos live in `server/uploads/` — back that up with it.

### A note on copy

The storefront deliberately makes no claim it cannot keep. There are no
testimonials until real buyers give them, no follower counts (there is no
following feature), and the "Verified" badge means one specific thing: the
seller confirmed their email. If you add marketing copy, keep it to things
the product actually does — the FAQ and Buyer Protection pages describe the
real prepaid flow, not a cash-on-delivery one.

### A note on imagery

Every photo under `assets/` is either an original brand asset or sourced from
[Pexels](https://www.pexels.com) under their free license (commercial use
permitted, no attribution required). None are real Bechdou seller photos —
they're placeholders until your own sellers upload real listing photos, at
which point the seeded/fallback images stop appearing for that category
automatically (see `CATEGORY_FALLBACK_ART` in `script.js`).

---

## 📝 Notes & next steps

- **Palette** is intentionally locked to Bechdou's brand tokens (merlot, powder
  blue, cream); the redesign only uses those colors, their gradients/opacities,
  and neutrals.
- **Payments are manual by design.** There is no card gateway and no automated
  JazzCash/EasyPaisa API — buyers transfer money themselves and an admin
  confirms each one. That is deliberate for launch (no merchant onboarding, no
  approval wait), but it does mean every order needs a human to confirm it.
- **Security:** tokens are bearer tokens in `localStorage`; for a larger
  deployment prefer httpOnly cookies. Rate limiting is in-memory, so it resets
  on restart and is per-process.
- **Not a static-only deploy:** the app needs the Node server for the API, so it
  won't run as a pure GitHub Pages site. Host on any Node platform (Render,
  Railway, Fly, a VPS, etc.) — pick one with a *persistent disk*, or SQLite and
  the uploaded photos are wiped on every deploy.
- **Ideas:** automated JazzCash/EasyPaisa gateway, cart + multi-item checkout,
  seller payout history, Urdu/RTL, real PNG PWA icons.
