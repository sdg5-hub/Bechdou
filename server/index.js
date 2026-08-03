// Bechdou backend — Express REST API over node:sqlite. Serves the static
// frontend and the /api/* endpoints from a single origin.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPassword, hashPassword, signToken, verifyToken, createLinkToken, hashLinkToken } from "./auth.js";
import {
  seedIfEmpty, reseed,
  getAccountById, getAccountRowByEmail, getAccountRowById, getAccountByHandle, createAccount,
  listAccountsFull, publicSellerProfiles,
  updateAccountProfile, setAccountPassword, setEmailVerified, setAccountSuspended,
  issueAuthToken, consumeAuthToken,
  createPendingSignup, getPendingSignupByEmail, consumePendingSignupByToken,
  listingsForViewer, approvedListings, getListingById, createListing, setListingStatus, incrementViews, toggleSave,
  updateListing, deleteListing, setListingSold,
  createOrder, getOrderById, ordersForViewer, ordersForListing, updateOrder, updateOrderByReference, COMMISSION_RATE,
  markOrderShipped, setOrderPayout,
  addEvent, listEvents, marketStatus,
} from "./db.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PORT = process.env.PORT || 4000;

const FALLBACK_IMAGE = "./assets/bechdou-editorial-collage.png";

// Manual wallet/bank transfer only — no payment gateway, no cards. The buyer
// sends the full amount to Bechdou's own account, then enters the
// transaction reference below; the seller is paid out separately by the
// admin once the order is confirmed. Real account details belong in
// server/.env — the values here are visible placeholders, not real numbers.
const paymentOptions = [
  {
    id: "jazzcash",
    label: "JazzCash",
    accountTitle: process.env.JAZZCASH_ACCOUNT_TITLE || "Bechdou Marketplace",
    accountNumber: process.env.JAZZCASH_ACCOUNT_NUMBER || "0300-0000000",
    note: "Send the full amount to this JazzCash number, then enter the transaction ID below.",
  },
  {
    id: "easypaisa",
    label: "EasyPaisa",
    accountTitle: process.env.EASYPAISA_ACCOUNT_TITLE || "Bechdou Marketplace",
    accountNumber: process.env.EASYPAISA_ACCOUNT_NUMBER || "0300-0000000",
    note: "Send the full amount to this EasyPaisa number, then enter the transaction ID below.",
  },
  {
    id: "bank-transfer",
    label: "Bank transfer",
    accountTitle: process.env.BANK_ACCOUNT_TITLE || "Bechdou Marketplace",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "PK00 BANK 0000 0000 0000 0000",
    bankName: process.env.BANK_NAME || "Bank name",
    note: "Transfer the full amount to this account, then enter the reference number below.",
  },
];
const PAYMENT_METHOD_IDS = new Set(paymentOptions.map((option) => option.id));

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
seedIfEmpty();

const app = express();

/* ---------- Stripe (lazy async init — only loads when STRIPE_SECRET_KEY is set) ---------- */
let _stripe = null;
async function stripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const { default: Stripe } = await import("stripe");
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

/* =====================================================================
   STRIPE WEBHOOK — must be registered BEFORE express.json() so that the
   raw body is available for signature verification.
   ===================================================================== */
app.post("/api/webhooks/stripe", express.raw({ type: "*/*" }), async (req, res) => {
  const client = await stripe();
  if (!client) return res.status(503).json({ error: "Stripe not configured." });

  let event;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    try {
      event = client.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
    } catch (err) {
      return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
    }
  } else {
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const order = updateOrderByReference(session.id, {
      status: "Payment received",
      payment_status: "Paid",
    });
    if (order) addEvent("payment", `Stripe payment confirmed — session ${session.id.slice(-8)}.`, null, order.id);
  }

  res.json({ received: true });
});

/* ---------- Global JSON body parser (after webhook raw route) ---------- */
app.use(express.json({ limit: "12mb" }));

/* ---------- Auth middleware ---------- */
function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}
app.use((req, res, next) => {
  const claims = verifyToken(readToken(req));
  const account = claims?.sub ? getAccountById(claims.sub, { full: true }) : null;

  // A suspension must take effect immediately — tokens issued before the
  // suspension are otherwise valid for days.
  if (account?.suspended) {
    return res.status(403).json({ error: "This account is suspended. Contact support@bechdou.pk." });
  }

  req.account = account;
  next();
});
function requireAuth(req, res, next) {
  if (!req.account) return res.status(401).json({ error: "Please log in to continue." });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.account || !roles.includes(req.account.role)) {
      return res.status(403).json({ error: "You do not have access to this action." });
    }
    next();
  };
}

/* ---------- Image persistence (base64 data URL -> file) ---------- */
function persistImage(image, id) {
  if (!image || typeof image !== "string") return FALLBACK_IMAGE;
  const match = image.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/s);
  if (!match) return image; // already a URL or ./assets path
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const file = `${id}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, file), Buffer.from(match[2], "base64"));
  return `/uploads/${file}`;
}

/* ---------- Async route wrapper (handles both sync and async handlers) ---------- */
const asyncRoute = (fn) => (req, res) => {
  const result = fn(req, res);
  if (result && typeof result.catch === "function") {
    result.catch((error) => {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: "Something went wrong." });
    });
  }
};

/* =====================================================================
   AUTH
   ===================================================================== */
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

/* ---------- Rate limiting (in-memory, per IP+route) ----------
   Slows down credential stuffing and stops the reset endpoint being used as a
   mail cannon. A single-process store is enough for this deployment size. */
const rateBuckets = new Map();

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);

    if (hits.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message });
    }

    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}

// Keep the bucket map from growing without bound on a long-running process.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, hits] of rateBuckets) {
    const fresh = hits.filter((t) => t > cutoff);
    if (fresh.length) rateBuckets.set(key, fresh);
    else rateBuckets.delete(key);
  }
}, 15 * 60 * 1000).unref();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait a few minutes and try again.",
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many accounts created from this device. Please try again later.",
});
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many email requests. Please wait before requesting another.",
});

// Legacy path — resends against an already-created (pre-this-change) account.
async function issueVerificationEmail(accountRow) {
  const { token, tokenHash } = createLinkToken();
  issueAuthToken(accountRow.id, "verify-email", tokenHash, VERIFY_TTL_MS);
  return sendVerificationEmail({ to: accountRow.email, name: accountRow.name, token });
}

// No account row is created here. Signup data sits in pending_signups until
// the link is clicked, so an abandoned signup never blocks a retry with the
// same email — there is nothing "already existing" to collide with.
app.post("/api/auth/signup", signupLimiter, asyncRoute(async (req, res) => {
  const { name, email, password, role, phone, city } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (getAccountRowByEmail(email)) return res.status(409).json({ error: "An account already exists for this email." });

  const { token, tokenHash } = createLinkToken();
  createPendingSignup(
    { name, email, passwordHash: hashPassword(password), role, phone, city },
    tokenHash,
    VERIFY_TTL_MS,
  );
  const delivery = await sendVerificationEmail({ to: email, name, token });

  res.status(202).json({
    pendingVerification: true,
    email: String(email).trim().toLowerCase(),
    emailSent: delivery.delivered,
  });
}));

app.post("/api/auth/login", loginLimiter, asyncRoute((req, res) => {
  const { email, password } = req.body || {};
  const row = getAccountRowByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "Email or password did not match." });
  }
  if (row.suspended) {
    return res.status(403).json({ error: "This account is suspended. Contact support@bechdou.pk." });
  }
  res.json({ token: signToken({ sub: row.id, role: row.role }), account: getAccountById(row.id, { full: true }) });
}));

// The account is actually created here, the moment the link is confirmed —
// verifying an email and creating the account are now the same action.
app.post("/api/auth/verify-email", asyncRoute((req, res) => {
  const tokenHash = hashLinkToken(req.body?.token);

  const pending = consumePendingSignupByToken(tokenHash);
  if (pending) {
    if (getAccountRowByEmail(pending.email)) {
      // Two verification links existed and one already resolved this email.
      return res.status(409).json({ error: "An account already exists for this email." });
    }
    const account = createAccount({
      name: pending.name,
      email: pending.email,
      password: null,
      passwordHash: pending.password_hash,
      role: pending.role,
      phone: pending.phone,
      city: pending.city,
    });
    setEmailVerified(account.id);
    addEvent("account", `${account.name} created a ${account.role} account.`, account.id, account.id);
    return res.json({
      token: signToken({ sub: account.id, role: account.role }),
      account: getAccountById(account.id, { full: true }),
    });
  }

  // Fallback for accounts created before this change, or created directly
  // by an admin — those still verify against an existing account row.
  const accountId = consumeAuthToken(tokenHash, "verify-email");
  if (!accountId) return res.status(400).json({ error: "This verification link is invalid or has expired." });
  setEmailVerified(accountId);
  const account = getAccountById(accountId, { full: true });
  res.json({ token: signToken({ sub: account.id, role: account.role }), account });
}));

// Works both signed in (legacy unverified account) and signed out
// (unfinished signup) — the "Resend email" button appears in both places.
app.post("/api/auth/resend-verification", emailLimiter, asyncRoute(async (req, res) => {
  if (req.account) {
    const row = getAccountRowById(req.account.id);
    if (row.email_verified) return res.json({ alreadyVerified: true });
    const delivery = await issueVerificationEmail(row);
    return res.json({ emailSent: delivery.delivered });
  }

  const email = String(req.body?.email || "").trim();
  if (!email) return res.status(400).json({ error: "Email is required." });

  const pending = getPendingSignupByEmail(email);
  if (pending) {
    const { token, tokenHash } = createLinkToken();
    createPendingSignup(
      { name: pending.name, email: pending.email, passwordHash: pending.password_hash, role: pending.role, phone: pending.phone, city: pending.city },
      tokenHash,
      VERIFY_TTL_MS,
    );
    const delivery = await sendVerificationEmail({ to: pending.email, name: pending.name, token });
    return res.json({ emailSent: delivery.delivered });
  }

  // Unauthenticated + unknown email: report success without leaking whether
  // an account exists, same as forgot-password.
  const row = getAccountRowByEmail(email);
  if (row && !row.email_verified) await issueVerificationEmail(row);
  res.json({ emailSent: true });
}));

app.post("/api/auth/forgot-password", emailLimiter, asyncRoute(async (req, res) => {
  const row = getAccountRowByEmail(req.body?.email);
  // Always report success so the endpoint cannot be used to discover which
  // emails have accounts.
  if (row && !row.suspended) {
    const { token, tokenHash } = createLinkToken();
    issueAuthToken(row.id, "reset-password", tokenHash, RESET_TTL_MS);
    await sendPasswordResetEmail({ to: row.email, name: row.name, token });
  }
  res.json({ ok: true });
}));

app.post("/api/auth/reset-password", asyncRoute((req, res) => {
  const { token, password } = req.body || {};
  if (String(password || "").length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const accountId = consumeAuthToken(hashLinkToken(token), "reset-password");
  if (!accountId) return res.status(400).json({ error: "This reset link is invalid or has expired." });
  setAccountPassword(accountId, hashPassword(password));
  addEvent("account", "Password reset completed.", accountId, accountId);
  const account = getAccountById(accountId, { full: true });
  res.json({ token: signToken({ sub: account.id, role: account.role }), account });
}));

app.get("/api/auth/me", (req, res) => res.json({ account: req.account || null }));

/* =====================================================================
   PROFILES
   ===================================================================== */
app.patch("/api/profile", requireAuth, asyncRoute((req, res) => {
  const { name, bio, handle, phone, city, avatar } = req.body || {};
  const fields = { name, bio, handle, phone, city };

  if (handle !== undefined) {
    const normalized = String(handle).trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (normalized.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters." });
    const taken = getAccountByHandle(normalized);
    if (taken && taken.id !== req.account.id) return res.status(409).json({ error: "That username is taken." });
    fields.handle = `@${normalized}`;
  }
  if (avatar !== undefined) fields.avatar = persistImage(avatar, `avatar-${req.account.id}-${Date.now().toString(36)}`);

  res.json({ account: updateAccountProfile(req.account.id, fields) });
}));

app.get("/api/sellers/:handle", asyncRoute((req, res) => {
  const row = getAccountByHandle(req.params.handle);
  if (!row) return res.status(404).json({ error: "Closet not found." });
  const seller = getAccountById(row.id);
  const listings = approvedListings().filter((l) => l.sellerId === row.id);
  res.json({ seller, listings });
}));

/* =====================================================================
   BOOTSTRAP — one call hydrates the whole app
   ===================================================================== */
app.get("/api/bootstrap", asyncRoute((req, res) => {
  const viewer = req.account;
  let accounts;
  if (viewer?.role === "admin") {
    accounts = listAccountsFull();
  } else {
    const byId = new Map();
    for (const seller of publicSellerProfiles()) byId.set(seller.id, seller);
    if (viewer) byId.set(viewer.id, viewer);
    accounts = [...byId.values()];
  }
  res.json({
    account: viewer || null,
    accounts,
    listings: listingsForViewer(viewer),
    orders: ordersForViewer(viewer),
    events: listEvents(40),
    paymentOptions,
    commissionRate: COMMISSION_RATE,
    marketStatus: marketStatus(),
  });
}));

/* =====================================================================
   LISTINGS
   ===================================================================== */
app.get("/api/listings", asyncRoute((req, res) => {
  res.json({ listings: approvedListings(req.query) });
}));

app.get("/api/listings/:id", asyncRoute((req, res) => {
  const listing = getListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  incrementViews(req.params.id);
  res.json({ listing });
}));

const MAX_IMAGES = 6;

function persistImages(images, id) {
  if (!Array.isArray(images)) return [];
  return images
    .slice(0, MAX_IMAGES)
    .map((img, index) => persistImage(img, `${id}-${index}`))
    .filter(Boolean);
}

const MAX_PRICE = 10_000_000; // Rs 10m — well above any realistic resale piece

// Shared by create and edit so both paths reject the same bad input.
function validateListing(data, { partial = false } = {}) {
  if (!partial || data.title !== undefined) {
    if (!String(data.title || "").trim()) return "A title is required.";
    if (String(data.title).trim().length > 120) return "Title must be 120 characters or fewer.";
  }
  if (!partial || data.price !== undefined) {
    const price = Number(data.price);
    if (!Number.isFinite(price) || price <= 0) return "Enter a price greater than zero.";
    if (price > MAX_PRICE) return "That price looks too high — please check it.";
  }
  if (data.retailPrice !== undefined && data.retailPrice !== "" && data.retailPrice !== null) {
    const retail = Number(data.retailPrice);
    if (!Number.isFinite(retail) || retail < 0) return "Retail price must be a positive number.";
    if (retail > MAX_PRICE) return "That retail price looks too high — please check it.";
  }
  if (String(data.description || "").length > 4000) return "Description is too long.";
  return null;
}

app.post("/api/listings", requireRole("seller", "admin"), asyncRoute((req, res) => {
  const data = req.body || {};
  const invalid = validateListing(data);
  if (invalid) return res.status(400).json({ error: invalid });
  const id = `lst-${Date.now().toString(36)}`;

  const gallery = persistImages(data.images, id);
  if (gallery.length) {
    data.images = gallery;
    data.image = gallery[0];
  } else {
    data.image = persistImage(data.image, id);
    data.images = [data.image];
  }

  const listing = createListing(data, req.account);
  addEvent("listing", `${listing.title} submitted for approval by ${req.account.name}.`, req.account.id, listing.id);
  res.status(201).json({ listing });
}));

// Sellers may edit or remove their own listings; admins may act on any.
function loadOwnedListing(req, res) {
  const listing = getListingById(req.params.id);
  if (!listing) {
    res.status(404).json({ error: "Listing not found." });
    return null;
  }
  if (req.account.role !== "admin" && listing.sellerId !== req.account.id) {
    res.status(403).json({ error: "This listing belongs to another seller." });
    return null;
  }
  return listing;
}

app.patch("/api/listings/:id", requireAuth, asyncRoute((req, res) => {
  const existing = loadOwnedListing(req, res);
  if (!existing) return;

  const invalid = validateListing(req.body || {}, { partial: true });
  if (invalid) return res.status(400).json({ error: invalid });

  const data = { ...req.body };
  const gallery = persistImages(data.images, `${existing.id}-${Date.now().toString(36)}`);
  if (gallery.length) {
    data.images = gallery;
    data.image = gallery[0];
  } else {
    delete data.images;
    delete data.image;
  }

  const listing = updateListing(existing.id, data);
  addEvent("listing", `${listing.title} was edited by ${req.account.name}.`, req.account.id, listing.id);
  res.json({ listing });
}));

app.delete("/api/listings/:id", requireAuth, asyncRoute((req, res) => {
  const listing = loadOwnedListing(req, res);
  if (!listing) return;

  // Deleting a piece mid-fulfilment would orphan the buyer's order.
  const live = ordersForListing(listing.id).filter(
    (o) => !["Cancelled", "Delivered"].includes(o.status),
  );
  if (live.length) {
    return res.status(409).json({
      error: "This piece has an order in progress. Cancel or complete the order first.",
    });
  }

  deleteListing(listing.id);
  addEvent("listing", `${listing.title} was removed by ${req.account.name}.`, req.account.id, listing.id);
  res.json({ ok: true });
}));

app.post("/api/listings/:id/sold", requireAuth, asyncRoute((req, res) => {
  const existing = loadOwnedListing(req, res);
  if (!existing) return;
  const sold = req.body?.sold !== false;
  const listing = setListingSold(existing.id, sold);
  addEvent("listing", `${listing.title} marked ${sold ? "sold" : "available"}.`, req.account.id, listing.id);
  res.json({ listing });
}));

app.post("/api/listings/:id/approve", requireRole("admin"), asyncRoute((req, res) => {
  const listing = setListingStatus(req.params.id, "approved");
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  addEvent("listing", `${listing.title} approved for the public drop.`, req.account.id, listing.id);
  res.json({ listing });
}));

app.post("/api/listings/:id/reject", requireRole("admin"), asyncRoute((req, res) => {
  const listing = setListingStatus(req.params.id, "rejected");
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  addEvent("listing", `${listing.title} rejected from review.`, req.account.id, listing.id);
  res.json({ listing });
}));

app.post("/api/listings/:id/save", requireAuth, asyncRoute((req, res) => {
  const listing = getListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  res.json(toggleSave(req.account.id, req.params.id));
}));

/* =====================================================================
   STRIPE CHECKOUT
   ===================================================================== */
app.post("/api/checkout/stripe", requireAuth, asyncRoute(async (req, res) => {
  const client = await stripe();
  if (!client) {
    return res.status(503).json({
      error: "Stripe is not configured on this server. Set STRIPE_SECRET_KEY and restart.",
    });
  }

  const { listingId, buyerName, contact, deliveryCity, note } = req.body || {};
  const listing = getListingById(listingId);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.status !== "approved") return res.status(400).json({ error: "This piece is not available." });

  // Default to PKR. Set STRIPE_CURRENCY=usd for testing with a US Stripe account.
  const currency = (process.env.STRIPE_CURRENCY || "pkr").toLowerCase();
  // Stripe amounts are in the smallest currency unit (paise for PKR, cents for USD).
  const unitAmount = Math.round(listing.price * 100);

  const origin = `${req.protocol}://${req.get("host")}`;
  const session = await client.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency,
        product_data: {
          name: listing.title,
          description: listing.description || undefined,
        },
        unit_amount: unitAmount,
      },
      quantity: 1,
    }],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#browse`,
    metadata: { listingId, buyerId: req.account.id },
  });

  const order = createOrder({
    listingId,
    buyerId: req.account.id,
    buyerName: buyerName || req.account.name,
    contact: contact || req.account.phone || "",
    deliveryCity: deliveryCity || req.account.city || "",
    note: note || "",
    amount: listing.price,
    paymentMethod: "stripe-checkout",
    paymentStatus: "Awaiting Stripe",
    paymentReference: session.id,
    status: "Requested",
  });

  addEvent("order", `Stripe checkout started for ${listing.title}.`, req.account.id, order.id);
  res.json({ url: session.url, orderId: order.id });
}));

/* Stripe-hosted checkout success redirect — bring the buyer back into the SPA. */
app.get("/checkout/success", (_req, res) => {
  res.redirect("/#checkout-success");
});

/* =====================================================================
   ORDERS
   ===================================================================== */
app.post("/api/orders", requireAuth, asyncRoute((req, res) => {
  const data = req.body || {};
  const listing = getListingById(data.listingId);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.status !== "approved") return res.status(400).json({ error: "This piece is not available." });
  if (listing.sold) return res.status(409).json({ error: "This piece has already sold." });
  if (listing.sellerId === req.account.id) return res.status(400).json({ error: "You cannot buy your own listing." });
  if (!String(data.contact || "").trim()) return res.status(400).json({ error: "A contact number is required for delivery." });
  if (!String(data.deliveryAddress || "").trim()) return res.status(400).json({ error: "A delivery address is required." });
  if (!PAYMENT_METHOD_IDS.has(data.paymentMethod)) {
    return res.status(400).json({ error: "Choose JazzCash, EasyPaisa, or a bank transfer." });
  }
  if (!String(data.paymentReference || "").trim()) {
    return res.status(400).json({ error: "Enter the transaction ID or reference for your payment." });
  }

  const order = createOrder({
    listingId: listing.id,
    buyerId: req.account.id,
    buyerName: data.buyerName || req.account.name,
    sellerId: listing.sellerId,
    contact: data.contact,
    deliveryCity: data.deliveryCity || req.account.city,
    deliveryAddress: data.deliveryAddress,
    note: data.note,
    amount: listing.price,
    paymentMethod: data.paymentMethod,
    paymentReference: data.paymentReference,
    // The buyer has already sent the money by the time they submit this
    // form — admin confirms it landed, there is no gateway to auto-verify.
    paymentStatus: "Awaiting confirmation",
    status: "Requested",
  });

  // Reserve the piece so a second buyer cannot order the same item.
  setListingSold(listing.id, true);
  addEvent("order", `Checkout requested for ${listing.title}.`, req.account.id, order.id);
  res.status(201).json({ order });
}));

app.get("/api/orders", requireAuth, asyncRoute((req, res) => {
  res.json({ orders: ordersForViewer(req.account) });
}));

const ORDER_ACTIONS = {
  paid: { payment_status: "Paid", status: "Payment received", verb: "Payment marked as paid" },
  qc: { status: "QC passed", verb: "QC passed" },
  dispatch: { status: "Dispatched", verb: "Order dispatched" },
  delivered: { status: "Delivered", verb: "Order delivered" },
  cancel: { status: "Cancelled", verb: "Order cancelled" },
};

app.post("/api/orders/:id/status", requireRole("admin"), asyncRoute((req, res) => {
  const action = ORDER_ACTIONS[req.body?.action];
  if (!action) return res.status(400).json({ error: "Unknown order action." });
  const fields = { status: action.status };
  if (action.payment_status) fields.payment_status = action.payment_status;
  if (req.body.action === "cancel") fields.payment_status = "Cancelled";

  const existing = getOrderById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found." });

  const order = updateOrder(req.params.id, fields);
  // Cancelling frees the piece; delivering retires it for good.
  if (req.body.action === "cancel") setListingSold(order.listingId, false);
  if (req.body.action === "delivered") setListingSold(order.listingId, true);

  const listing = getListingById(order.listingId);
  addEvent("order", `${action.verb} — ${listing?.title || "order"}.`, req.account.id, order.id);
  res.json({ order });
}));

// Buyers may cancel their own order until it has been dispatched.
app.post("/api/orders/:id/cancel", requireAuth, asyncRoute((req, res) => {
  const existing = getOrderById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (existing.buyerId !== req.account.id) {
    return res.status(403).json({ error: "This order belongs to another buyer." });
  }
  if (existing.status === "Cancelled") return res.status(400).json({ error: "This order is already cancelled." });
  if (existing.shippedAt || ["Dispatched", "Delivered"].includes(existing.status)) {
    return res.status(400).json({ error: "This order has already shipped and can no longer be cancelled." });
  }

  const order = updateOrder(existing.id, { status: "Cancelled", payment_status: "Cancelled" });
  setListingSold(order.listingId, false);
  const listing = getListingById(order.listingId);
  addEvent("order", `${listing?.title || "Order"} cancelled by buyer.`, req.account.id, order.id);
  res.json({ order });
}));

// Sellers dispatch their own sales; admins may dispatch any order.
app.post("/api/orders/:id/ship", requireAuth, asyncRoute((req, res) => {
  const existing = getOrderById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (req.account.role !== "admin" && existing.sellerId !== req.account.id) {
    return res.status(403).json({ error: "This order belongs to another seller." });
  }
  if (existing.status === "Cancelled") return res.status(400).json({ error: "Cancelled orders cannot be shipped." });

  const order = markOrderShipped(existing.id);
  const listing = getListingById(order.listingId);
  addEvent("order", `${listing?.title || "Order"} marked shipped by ${req.account.name}.`, req.account.id, order.id);
  res.json({ order });
}));

app.post("/api/orders/:id/payout", requireRole("admin"), asyncRoute((req, res) => {
  const existing = getOrderById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found." });
  const status = req.body?.payoutStatus === "unpaid" ? "unpaid" : "paid";
  const order = setOrderPayout(existing.id, status);
  addEvent("payment", `Seller payout marked ${status} for order ${order.id}.`, req.account.id, order.id);
  res.json({ order });
}));

/* =====================================================================
   ACCOUNTS + ADMIN
   ===================================================================== */
app.get("/api/accounts", requireRole("admin"), asyncRoute((req, res) => {
  res.json({ accounts: listAccountsFull() });
}));

app.post("/api/accounts/:id/suspend", requireRole("admin"), asyncRoute((req, res) => {
  if (req.params.id === req.account.id) {
    return res.status(400).json({ error: "You cannot suspend your own admin account." });
  }
  const target = getAccountRowById(req.params.id);
  if (!target) return res.status(404).json({ error: "Account not found." });

  const suspended = req.body?.suspended !== false;
  const account = setAccountSuspended(target.id, suspended);
  addEvent("account", `${account.name} was ${suspended ? "suspended" : "reinstated"}.`, req.account.id, account.id);
  res.json({ account });
}));

app.post("/api/reset", requireRole("admin"), asyncRoute((req, res) => {
  reseed();
  res.json({ ok: true });
}));

/* =====================================================================
   STATIC FRONTEND
   ===================================================================== */
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(ROOT_DIR));

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

app.listen(PORT, () => {
  console.log(`Bechdou running on http://localhost:${PORT}`);
});
