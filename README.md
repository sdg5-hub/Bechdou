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
- Product **quick-view** with image gallery, COD trust, and WhatsApp deep-link
- Search, filters (city / condition / price / sort) and "saved" closet
- Installable **PWA** (manifest + service worker + "Add to Homescreen")
- Mobile sticky bottom nav, scroll-reveal animations, `prefers-reduced-motion`

**Marketplace engine**
- **Auth & roles** — buyer / seller / admin, scrypt-hashed passwords, JWT sessions
- **Sellers** submit listings (with photo upload) for review
- **Admins** approve / reject listings and run the order desk
- **Orders** — Cash on Delivery checkout, QC → dispatch → delivered lifecycle
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
| Buyer  | `mina@example.com`   | Browse, save, request COD checkout       |

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
| POST   | `/api/orders`                   | any user  | Request COD checkout                 |
| GET    | `/api/orders`                   | any user  | Orders (scoped by role)              |
| POST   | `/api/orders/:id/status`        | admin     | `paid` / `qc` / `dispatch` / `delivered` / `cancel` |
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

| Variable          | Default                | Notes                            |
|-------------------|------------------------|----------------------------------|
| `PORT`            | `4000`                 | HTTP port                        |
| `BECHDOU_SECRET`  | dev secret             | **Set this in production** (signs tokens) |
| `BECHDOU_DB`      | `server/bechdou.db`    | SQLite file path                 |

To wipe and re-seed, stop the server, delete `server/bechdou.db*`, and restart —
or just hit **Reset** in the UI as admin.

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
