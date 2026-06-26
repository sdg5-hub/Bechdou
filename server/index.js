// Bechdou backend — Express REST API over node:sqlite. Serves the static
// frontend and the /api/* endpoints from a single origin.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPassword, signToken, verifyToken } from "./auth.js";
import {
  seedIfEmpty, reseed,
  getAccountById, getAccountRowByEmail, createAccount, listAccountsFull, publicSellerProfiles,
  listingsForViewer, approvedListings, getListingById, createListing, setListingStatus, incrementViews, toggleSave,
  createOrder, ordersForViewer, updateOrder, updateOrderByReference,
  addEvent, listEvents, marketStatus,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PORT = process.env.PORT || 4000;

const COMMISSION_RATE = 0.15;
const FALLBACK_IMAGE = "./assets/bechdou-editorial-collage.png";
const paymentOptions = [
  { id: "stripe-checkout", label: "Stripe Checkout", status: "Card payment", note: "Hosted Stripe payment page; card data never touches Bechdou servers. Requires STRIPE_SECRET_KEY.", disabled: false },
  { id: "stripe-shipping", label: "Stripe shipping rates", status: "Delivery fee", note: "Checkout can collect shipping address and rates; Bechdou still owns courier fulfillment.", disabled: true, checkout: false },
  { id: "stripe-connect", label: "Stripe Connect", status: "Payouts", note: "Marketplace pattern for seller onboarding, application fees, and seller payouts.", disabled: true, checkout: false },
  { id: "manual-admin", label: "Admin assisted checkout", status: "Fallback", note: "Temporary admin-created order route if a buyer cannot complete Stripe checkout.", disabled: false },
  { id: "cash-on-delivery", label: "Cash on Delivery", status: "Recommended", note: "Buyer pays the courier in cash on delivery — the default across Pakistan.", disabled: false },
  { id: "wallet-transfer", label: "Legacy wallet transfer", status: "Legacy demo", note: "Kept only so older seeded demo orders still display correctly.", disabled: true, checkout: false },
];

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
app.use((req, _res, next) => {
  const claims = verifyToken(readToken(req));
  req.account = claims?.sub ? getAccountById(claims.sub, { full: true }) : null;
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
app.post("/api/auth/signup", asyncRoute((req, res) => {
  const { name, email, password, role, phone, city } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
  if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (getAccountRowByEmail(email)) return res.status(409).json({ error: "An account already exists for this email." });
  const account = createAccount({ name, email, password, role, phone, city });
  addEvent("account", `${account.name} created a ${account.role} account.`, account.id, account.id);
  res.status(201).json({ token: signToken({ sub: account.id, role: account.role }), account });
}));

app.post("/api/auth/login", asyncRoute((req, res) => {
  const { email, password } = req.body || {};
  const row = getAccountRowByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "Email or password did not match." });
  }
  res.json({ token: signToken({ sub: row.id, role: row.role }), account: getAccountById(row.id, { full: true }) });
}));

app.get("/api/auth/me", (req, res) => res.json({ account: req.account || null }));

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

app.post("/api/listings", requireRole("seller", "admin"), asyncRoute((req, res) => {
  const data = req.body || {};
  if (!data.title || !data.price) return res.status(400).json({ error: "Title and price are required." });
  const id = `lst-${Date.now().toString(36)}`;
  data.image = persistImage(data.image, id);
  const listing = createListing(data, req.account);
  addEvent("listing", `${listing.title} submitted for approval by ${req.account.name}.`, req.account.id, listing.id);
  res.status(201).json({ listing });
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
  const option = paymentOptions.find((o) => o.id === data.paymentMethod && !o.disabled);
  const order = createOrder({
    listingId: listing.id,
    buyerId: req.account.id,
    buyerName: data.buyerName || req.account.name,
    contact: data.contact,
    deliveryCity: data.deliveryCity,
    note: data.note,
    amount: listing.price,
    paymentMethod: option ? option.id : "cash-on-delivery",
    paymentStatus: option && option.id.startsWith("stripe") ? "Awaiting Stripe" : "Due on delivery",
    paymentReference: data.paymentReference,
    status: "Requested",
  });
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
  const order = updateOrder(req.params.id, fields);
  if (!order) return res.status(404).json({ error: "Order not found." });
  const listing = getListingById(order.listingId);
  addEvent("order", `${action.verb} — ${listing?.title || "order"}.`, req.account.id, order.id);
  res.json({ order });
}));

/* =====================================================================
   ACCOUNTS + ADMIN
   ===================================================================== */
app.get("/api/accounts", requireRole("admin"), asyncRoute((req, res) => {
  res.json({ accounts: listAccountsFull() });
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
