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

### Demo accounts

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
| GET    | `/api/listings`                 | —         | Approved listings (filter/search)    |
| GET    | `/api/listings/:id`             | —         | One listing (counts a view)          |
| POST   | `/api/listings`                 | seller    | Create listing (base64 image upload) |
| POST   | `/api/listings/:id/approve`     | admin     | Approve a listing                    |
| POST   | `/api/listings/:id/reject`      | admin     | Reject a listing                     |
| POST   | `/api/listings/:id/save`        | any user  | Toggle save/like                     |
| POST   | `/api/orders`                   | any user  | Checkout (JazzCash/EasyPaisa/bank + reference) |
| GET    | `/api/orders`                   | any user  | Orders (scoped by role)              |
| POST   | `/api/orders/:id/cancel`        | buyer     | Cancel own order before dispatch     |
| POST   | `/api/orders/:id/status`        | admin     | `paid` (confirm payment) / `qc` / `dispatch` / `delivered` / `cancel` |
| POST   | `/api/orders/:id/payout`        | admin     | Mark seller payout sent/unsent       |
| GET    | `/api/accounts`                 | admin     | All accounts                         |
| POST   | `/api/reset`                    | admin     | Restore seed data                    |

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
| `BECHDOU_SECRET`     | dev secret             | **Set this in production** (signs tokens) |
| `BECHDOU_DB`         | `server/bechdou.db`    | SQLite file path                 |
| `RESEND_API_KEY`     | —                      | Enables real email delivery      |
| `BECHDOU_FROM_EMAIL` | `onboarding@resend.dev`| Sender address on outgoing email |
| `BECHDOU_APP_URL`    | `http://localhost:4000`| Base URL used in email links     |
| `JAZZCASH_ACCOUNT_TITLE` / `JAZZCASH_ACCOUNT_NUMBER` | placeholder | Shown to buyers at checkout — **set to your real JazzCash details before launch** |
| `EASYPAISA_ACCOUNT_TITLE` / `EASYPAISA_ACCOUNT_NUMBER` | placeholder | Shown to buyers at checkout — **set to your real EasyPaisa details before launch** |
| `BANK_ACCOUNT_TITLE` / `BANK_ACCOUNT_NUMBER` / `BANK_NAME` | placeholder | Shown to buyers at checkout — **set to your real bank details before launch** |

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

---

## 📝 Notes & next steps

- **Palette** is intentionally locked to Bechdou's brand tokens (merlot, powder
  blue, cream); the redesign only uses those colors, their gradients/opacities,
  and neutrals.
- **Security:** prototype-grade. Tokens are bearer tokens in `localStorage`; for
  production prefer httpOnly cookies and set `BECHDOU_SECRET`.
- **Not a static-only deploy:** the app needs the Node server for the API, so it
  won't run as a pure GitHub Pages site. Host on any Node platform (Render,
  Railway, Fly, a VPS, etc.).
- **Ideas:** dedicated product-detail / seller-closet routes, image compression,
  Stripe checkout, Urdu/RTL, real PNG PWA icons.
