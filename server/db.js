// SQLite data layer (node:sqlite). Owns schema, seed, mappers and queries.
// Query functions return camelCase shapes that match the frontend's objects.
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.BECHDOU_DB || path.join(__dirname, "bechdou.db");
const DEMO_PASSWORD = "bechdou123";
const FALLBACK_IMAGE = "./assets/bechdou-editorial-collage.png";

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer',
    phone TEXT,
    city TEXT,
    handle TEXT,
    trust_score INTEGER DEFAULT 78,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    brand TEXT,
    price REAL NOT NULL,
    retail_price REAL,
    category TEXT,
    size TEXT,
    condition TEXT,
    location TEXT,
    color TEXT,
    fabric TEXT,
    measurements TEXT,
    flaws TEXT,
    seller_id TEXT NOT NULL,
    seller_name TEXT,
    description TEXT,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    front_photo INTEGER DEFAULT 0,
    back_photo INTEGER DEFAULT 0,
    label_photo INTEGER DEFAULT 0,
    measurements_check INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS saves (
    account_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    PRIMARY KEY (account_id, listing_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    buyer_id TEXT,
    buyer_name TEXT,
    contact TEXT,
    delivery_city TEXT,
    note TEXT,
    amount REAL,
    payment_method TEXT,
    payment_status TEXT,
    payment_reference TEXT,
    status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT,
    message TEXT,
    actor_id TEXT,
    entity_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens (token_hash);

  -- Holds signup data until the email is verified. No row in "accounts" is
  -- created until then, so an abandoned signup never blocks a retry.
  CREATE TABLE IF NOT EXISTS pending_signups (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer',
    phone TEXT,
    city TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pending_signups_token ON pending_signups (token_hash);
`);

/* ---------- Migrations (additive columns for pre-existing databases) ---------- */
function addColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (existing.some((col) => col.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

addColumn("accounts", "bio", "TEXT");
addColumn("accounts", "avatar", "TEXT");
addColumn("accounts", "email_verified", "INTEGER DEFAULT 0");
addColumn("accounts", "suspended", "INTEGER DEFAULT 0");
addColumn("listings", "images", "TEXT");
addColumn("listings", "sold", "INTEGER DEFAULT 0");
addColumn("orders", "seller_id", "TEXT");
addColumn("orders", "shipped_at", "TEXT");
addColumn("orders", "payout_status", "TEXT DEFAULT 'unpaid'");
addColumn("orders", "delivery_address", "TEXT");
// Stored at order time so the commission rate can change later without
// rewriting what past orders actually owed.
addColumn("orders", "commission_amount", "REAL DEFAULT 0");
addColumn("orders", "payout_amount", "REAL DEFAULT 0");

/* ---------- ID helper ---------- */
export function makeId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/* ---------- Mappers (row -> frontend shape) ---------- */
// Listings predating multi-image upload only have the single `image` column.
function parseImages(raw, fallback) {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {}
  }
  return fallback ? [fallback] : [];
}

function rowToListing(row, savedBy = []) {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    price: row.price,
    retailPrice: row.retail_price,
    category: row.category,
    size: row.size,
    condition: row.condition,
    location: row.location,
    color: row.color,
    fabric: row.fabric,
    measurements: row.measurements,
    flaws: row.flaws,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    description: row.description,
    image: row.image,
    images: parseImages(row.images, row.image),
    sold: !!row.sold,
    status: row.status,
    qualityChecks: {
      frontPhoto: !!row.front_photo,
      backPhoto: !!row.back_photo,
      labelPhoto: !!row.label_photo,
      measurements: !!row.measurements_check,
    },
    views: row.views,
    savedBy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAccount(row, { full = false, savedIds = [] } = {}) {
  const account = {
    id: row.id,
    name: row.name,
    role: row.role,
    city: row.city,
    handle: row.handle,
    bio: row.bio,
    avatar: row.avatar,
    trustScore: row.trust_score,
    savedListingIds: savedIds,
    createdAt: row.created_at,
  };
  if (full) {
    account.email = row.email;
    account.phone = row.phone;
    account.emailVerified = !!row.email_verified;
    account.suspended = !!row.suspended;
  }
  return account;
}

function rowToOrder(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    sellerId: row.seller_id,
    contact: row.contact,
    deliveryCity: row.delivery_city,
    deliveryAddress: row.delivery_address,
    note: row.note,
    amount: row.amount,
    commissionAmount: row.commission_amount,
    payoutAmount: row.payout_amount,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
    status: row.status,
    shippedAt: row.shipped_at,
    payoutStatus: row.payout_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    actorId: row.actor_id,
    entityId: row.entity_id,
    createdAt: row.created_at,
  };
}

/* ---------- Saves helpers ---------- */
function allSavesByListing() {
  const map = new Map();
  for (const row of db.prepare("SELECT account_id, listing_id FROM saves").all()) {
    if (!map.has(row.listing_id)) map.set(row.listing_id, []);
    map.get(row.listing_id).push(row.account_id);
  }
  return map;
}

export function savedIdsByAccount(accountId) {
  if (!accountId) return [];
  return db.prepare("SELECT listing_id FROM saves WHERE account_id = ?").all(accountId).map((r) => r.listing_id);
}

/* ---------- Accounts ---------- */
export function getAccountRowById(id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
}

export function getAccountRowByEmail(email) {
  return db.prepare("SELECT * FROM accounts WHERE email = ?").get(String(email || "").trim().toLowerCase());
}

export function getAccountById(id, { full = false } = {}) {
  const row = getAccountRowById(id);
  if (!row) return null;
  return rowToAccount(row, { full, savedIds: savedIdsByAccount(id) });
}

export function createAccount({ name, email, password, passwordHash, role, phone, city, handle, trustScore }) {
  const account = {
    id: makeId("acct"),
    name: String(name || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    // A verified pending signup already carries a hash — don't re-hash it.
    password_hash: passwordHash || hashPassword(password),
    role: ["buyer", "seller", "admin"].includes(role) ? role : "buyer",
    phone: String(phone || "").trim(),
    city: String(city || "").trim() || "Pakistan",
    handle: handle || "@" + String(name || email || "user").trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18),
    trust_score: trustScore ?? 78,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO accounts (id,name,email,password_hash,role,phone,city,handle,trust_score,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    account.id, account.name, account.email, account.password_hash, account.role,
    account.phone, account.city, account.handle, account.trust_score, account.created_at,
  );
  return getAccountById(account.id, { full: true });
}

const PROFILE_COLUMNS = { name: "name", bio: "bio", avatar: "avatar", handle: "handle", phone: "phone", city: "city" };

export function updateAccountProfile(id, fields) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(typeof fields[key] === "string" ? fields[key].trim() : fields[key]);
  }
  if (sets.length) db.prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
  return getAccountById(id, { full: true });
}

export function setAccountPassword(id, passwordHash) {
  db.prepare("UPDATE accounts SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function setEmailVerified(id) {
  db.prepare("UPDATE accounts SET email_verified = 1 WHERE id = ?").run(id);
}

export function setAccountSuspended(id, suspended) {
  db.prepare("UPDATE accounts SET suspended = ? WHERE id = ?").run(suspended ? 1 : 0, id);
  return getAccountById(id, { full: true });
}

export function getAccountByHandle(handle) {
  const normalized = String(handle || "").trim().replace(/^@/, "").toLowerCase();
  return db
    .prepare("SELECT * FROM accounts WHERE LOWER(REPLACE(handle, '@', '')) = ?")
    .get(normalized);
}

/* ---------- Single-use auth links ---------- */
export function issueAuthToken(accountId, purpose, tokenHash, ttlMs) {
  // Only one live link per purpose — issuing a new one invalidates the old.
  db.prepare("DELETE FROM auth_tokens WHERE account_id = ? AND purpose = ?").run(accountId, purpose);
  db.prepare(
    `INSERT INTO auth_tokens (id, account_id, token_hash, purpose, expires_at, created_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(
    makeId("tok"), accountId, tokenHash, purpose,
    new Date(Date.now() + ttlMs).toISOString(), new Date().toISOString(),
  );
}

export function consumeAuthToken(tokenHash, purpose) {
  const row = db
    .prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = ?")
    .get(tokenHash, purpose);
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  return row.account_id;
}

/* ---------- Pending signups (unverified, no account yet) ---------- */
export function createPendingSignup({ name, email, passwordHash, role, phone, city }, tokenHash, ttlMs) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const now = new Date().toISOString();
  // Lazy cleanup — no separate scheduler needed for a table this small.
  db.prepare("DELETE FROM pending_signups WHERE expires_at < ?").run(now);
  db.prepare(
    `INSERT INTO pending_signups (email,name,password_hash,role,phone,city,token_hash,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET
       name=excluded.name, password_hash=excluded.password_hash, role=excluded.role,
       phone=excluded.phone, city=excluded.city, token_hash=excluded.token_hash,
       expires_at=excluded.expires_at, created_at=excluded.created_at`,
  ).run(
    normalizedEmail, String(name || "").trim(), passwordHash,
    ["buyer", "seller", "admin"].includes(role) ? role : "buyer",
    String(phone || "").trim(), String(city || "").trim() || "Pakistan",
    tokenHash, new Date(Date.now() + ttlMs).toISOString(), now,
  );
}

export function getPendingSignupByEmail(email) {
  const row = db
    .prepare("SELECT * FROM pending_signups WHERE email = ?")
    .get(String(email || "").trim().toLowerCase());
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

// Consumes (deletes) the pending signup so a token can only create one account.
export function consumePendingSignupByToken(tokenHash) {
  const row = db.prepare("SELECT * FROM pending_signups WHERE token_hash = ?").get(tokenHash);
  if (!row) return null;
  db.prepare("DELETE FROM pending_signups WHERE email = ?").run(row.email);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export function listAccountsFull() {
  return db
    .prepare("SELECT * FROM accounts ORDER BY created_at ASC")
    .all()
    .map((row) => rowToAccount(row, { full: true, savedIds: savedIdsByAccount(row.id) }));
}

// Public seller profiles referenced by approved listings (for card/closet lookups).
export function publicSellerProfiles() {
  return db
    .prepare(
      `SELECT DISTINCT a.* FROM accounts a
       JOIN listings l ON l.seller_id = a.id
       WHERE l.status = 'approved'`,
    )
    .all()
    .map((row) => rowToAccount(row, { full: false }));
}

/* ---------- Listings ---------- */
export function listingsForViewer(viewer) {
  let rows;
  if (viewer?.role === "admin") {
    rows = db.prepare("SELECT * FROM listings ORDER BY created_at DESC").all();
  } else if (viewer?.role === "seller") {
    rows = db
      .prepare("SELECT * FROM listings WHERE status = 'approved' OR seller_id = ? ORDER BY created_at DESC")
      .all(viewer.id);
  } else {
    rows = db.prepare("SELECT * FROM listings WHERE status = 'approved' ORDER BY created_at DESC").all();
  }
  const saves = allSavesByListing();
  return rows.map((row) => rowToListing(row, saves.get(row.id) || []));
}

export function approvedListings({ category, city, condition, minPrice, maxPrice, search, sort } = {}) {
  const clauses = ["status = 'approved'"];
  const params = [];
  if (category && category !== "all") { clauses.push("category = ?"); params.push(category); }
  if (city && city !== "all") { clauses.push("location = ?"); params.push(city); }
  if (condition && condition !== "all") { clauses.push("condition = ?"); params.push(condition); }
  if (minPrice) { clauses.push("price >= ?"); params.push(Number(minPrice)); }
  if (maxPrice) { clauses.push("price <= ?"); params.push(Number(maxPrice)); }
  if (search) {
    clauses.push("(LOWER(title) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(seller_name) LIKE ? OR LOWER(color) LIKE ? OR LOWER(fabric) LIKE ?)");
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like, like, like, like, like);
  }
  let order = "created_at DESC";
  if (sort === "price-low") order = "price ASC";
  else if (sort === "price-high") order = "price DESC";
  const rows = db.prepare(`SELECT * FROM listings WHERE ${clauses.join(" AND ")} ORDER BY ${order}`).all(...params);
  const saves = allSavesByListing();
  return rows.map((row) => rowToListing(row, saves.get(row.id) || []));
}

export function getListingById(id) {
  const row = db.prepare("SELECT * FROM listings WHERE id = ?").get(id);
  if (!row) return null;
  return rowToListing(row, savedIdsByListing(id));
}

function savedIdsByListing(listingId) {
  return db.prepare("SELECT account_id FROM saves WHERE listing_id = ?").all(listingId).map((r) => r.account_id);
}

export function createListing(data, seller) {
  const now = new Date().toISOString();
  const listing = {
    id: makeId("lst"),
    title: String(data.title || "").trim(),
    brand: String(data.brand || "").trim() || "Unbranded",
    price: Number(data.price) || 0,
    retail_price: data.retailPrice ? Number(data.retailPrice) : null,
    category: data.category || "Tops",
    size: String(data.size || "").trim(),
    condition: data.condition || "Lightly worn",
    location: String(data.location || "").trim() || seller.city || "Pakistan",
    color: String(data.color || "").trim(),
    fabric: String(data.fabric || "").trim(),
    measurements: String(data.measurements || "").trim(),
    flaws: String(data.flaws || "").trim(),
    seller_id: seller.id,
    seller_name: seller.name,
    description: String(data.description || "").trim(),
    image: data.image || FALLBACK_IMAGE,
    images: JSON.stringify(Array.isArray(data.images) && data.images.length ? data.images : [data.image || FALLBACK_IMAGE]),
    status: "pending",
    front_photo: data.qualityChecks?.frontPhoto ? 1 : 0,
    back_photo: data.qualityChecks?.backPhoto ? 1 : 0,
    label_photo: data.qualityChecks?.labelPhoto ? 1 : 0,
    measurements_check: data.qualityChecks?.measurements ? 1 : 0,
    views: 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO listings (id,title,brand,price,retail_price,category,size,condition,location,color,fabric,
      measurements,flaws,seller_id,seller_name,description,image,images,status,front_photo,back_photo,label_photo,
      measurements_check,views,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    listing.id, listing.title, listing.brand, listing.price, listing.retail_price, listing.category,
    listing.size, listing.condition, listing.location, listing.color, listing.fabric, listing.measurements,
    listing.flaws, listing.seller_id, listing.seller_name, listing.description, listing.image, listing.images,
    listing.status, listing.front_photo, listing.back_photo, listing.label_photo, listing.measurements_check,
    listing.views, listing.created_at, listing.updated_at,
  );
  return getListingById(listing.id);
}

const LISTING_COLUMNS = {
  title: "title", brand: "brand", price: "price", retailPrice: "retail_price",
  category: "category", size: "size", condition: "condition", location: "location",
  color: "color", fabric: "fabric", measurements: "measurements", flaws: "flaws",
  description: "description", image: "image",
};

export function updateListing(id, fields) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(LISTING_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = ?`);
    const raw = fields[key];
    values.push(key === "price" || key === "retailPrice" ? Number(raw) || 0 : typeof raw === "string" ? raw.trim() : raw);
  }
  if (Array.isArray(fields.images) && fields.images.length) {
    sets.push("images = ?");
    values.push(JSON.stringify(fields.images));
  }
  if (!sets.length) return getListingById(id);
  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  db.prepare(`UPDATE listings SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
  return getListingById(id);
}

export function deleteListing(id) {
  db.prepare("DELETE FROM saves WHERE listing_id = ?").run(id);
  db.prepare("DELETE FROM listings WHERE id = ?").run(id);
}

export function setListingSold(id, sold) {
  db.prepare("UPDATE listings SET sold = ?, updated_at = ? WHERE id = ?")
    .run(sold ? 1 : 0, new Date().toISOString(), id);
  return getListingById(id);
}

export function setListingStatus(id, status) {
  const row = db.prepare("SELECT * FROM listings WHERE id = ?").get(id);
  if (!row) return null;
  db.prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  return getListingById(id);
}

export function incrementViews(id) {
  db.prepare("UPDATE listings SET views = views + 1 WHERE id = ?").run(id);
}

export function toggleSave(accountId, listingId) {
  const existing = db.prepare("SELECT 1 FROM saves WHERE account_id = ? AND listing_id = ?").get(accountId, listingId);
  if (existing) {
    db.prepare("DELETE FROM saves WHERE account_id = ? AND listing_id = ?").run(accountId, listingId);
    return { saved: false };
  }
  db.prepare("INSERT INTO saves (account_id, listing_id) VALUES (?, ?)").run(accountId, listingId);
  return { saved: true };
}

/* ---------- Orders ---------- */
// Bechdou's cut of each sale. A named export so index.js and db.js agree on
// one number, and so it is easy to find when it needs to change.
export const COMMISSION_RATE = 0.20;

export function createOrder(data) {
  const now = new Date().toISOString();
  const amount = Number(data.amount) || 0;
  // Rounded to the rupee — fractional paisa serve no purpose in a manual
  // wallet-transfer flow and would just look like a bug to the seller.
  const commissionAmount = Math.round(amount * COMMISSION_RATE);
  const order = {
    id: makeId("ord"),
    listing_id: data.listingId,
    buyer_id: data.buyerId || null,
    buyer_name: String(data.buyerName || "").trim(),
    seller_id: data.sellerId || null,
    contact: String(data.contact || "").trim(),
    delivery_city: String(data.deliveryCity || "").trim(),
    delivery_address: String(data.deliveryAddress || "").trim(),
    note: String(data.note || "").trim(),
    amount,
    commission_amount: commissionAmount,
    payout_amount: amount - commissionAmount,
    payment_method: data.paymentMethod || "manual-admin",
    payment_status: data.paymentStatus || "Awaiting payment",
    payment_reference: String(data.paymentReference || "").trim(),
    status: data.status || "Requested",
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO orders (id,listing_id,buyer_id,buyer_name,seller_id,contact,delivery_city,delivery_address,
      note,amount,commission_amount,payout_amount,payment_method,payment_status,payment_reference,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    order.id, order.listing_id, order.buyer_id, order.buyer_name, order.seller_id, order.contact,
    order.delivery_city, order.delivery_address, order.note, order.amount, order.commission_amount,
    order.payout_amount, order.payment_method, order.payment_status, order.payment_reference,
    order.status, order.created_at, order.updated_at,
  );
  return getOrderById(order.id);
}

export function getOrderById(id) {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  return row ? rowToOrder(row) : null;
}

export function ordersForViewer(viewer) {
  if (!viewer) return [];
  let rows;
  if (viewer.role === "admin") {
    rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  } else if (viewer.role === "seller") {
    rows = db
      .prepare(
        `SELECT o.* FROM orders o JOIN listings l ON l.id = o.listing_id
         WHERE l.seller_id = ? ORDER BY o.created_at DESC`,
      )
      .all(viewer.id);
  } else {
    rows = db.prepare("SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC").all(viewer.id);
  }
  return rows.map(rowToOrder);
}

export function updateOrder(id, fields) {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!row) return null;
  const next = { ...row, ...fields, updated_at: new Date().toISOString() };
  db.prepare(
    `UPDATE orders SET payment_status = ?, payment_reference = ?, status = ?, updated_at = ? WHERE id = ?`,
  ).run(next.payment_status, next.payment_reference, next.status, next.updated_at, id);
  return getOrderById(id);
}

export function ordersForListing(listingId) {
  return db
    .prepare("SELECT * FROM orders WHERE listing_id = ? ORDER BY created_at DESC")
    .all(listingId)
    .map(rowToOrder);
}

export function markOrderShipped(id) {
  const now = new Date().toISOString();
  db.prepare("UPDATE orders SET status = 'Dispatched', shipped_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);
  return getOrderById(id);
}

export function setOrderPayout(id, payoutStatus) {
  db.prepare("UPDATE orders SET payout_status = ?, updated_at = ? WHERE id = ?")
    .run(payoutStatus, new Date().toISOString(), id);
  return getOrderById(id);
}

export function updateOrderByReference(reference, fields) {
  const row = db.prepare("SELECT * FROM orders WHERE payment_reference = ?").get(String(reference || ""));
  if (!row) return null;
  const updates = [];
  const params = [];
  if (fields.status) { updates.push("status = ?"); params.push(fields.status); }
  if (fields.payment_status) { updates.push("payment_status = ?"); params.push(fields.payment_status); }
  if (!updates.length) return getOrderById(row.id);
  params.push(new Date().toISOString(), row.id);
  db.prepare(`UPDATE orders SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`).run(...params);
  return getOrderById(row.id);
}

/* ---------- Events ---------- */
export function addEvent(type, message, actorId = "", entityId = "") {
  const event = {
    id: makeId("evt"),
    type,
    message,
    actor_id: actorId,
    entity_id: entityId,
    created_at: new Date().toISOString(),
  };
  db.prepare("INSERT INTO events (id,type,message,actor_id,entity_id,created_at) VALUES (?,?,?,?,?,?)").run(
    event.id, event.type, event.message, event.actor_id, event.entity_id, event.created_at,
  );
  return rowToEvent(event);
}

export function listEvents(limit = 40) {
  return db.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?").all(limit).map(rowToEvent);
}

/* ---------- Market status (public availability) ---------- */
export function marketStatus() {
  const reserved = db
    .prepare("SELECT DISTINCT listing_id FROM orders WHERE status NOT IN ('Cancelled','Delivered')")
    .all()
    .map((r) => r.listing_id);
  const sold = db
    .prepare("SELECT DISTINCT listing_id FROM orders WHERE status = 'Delivered'")
    .all()
    .map((r) => r.listing_id);
  return { reserved, sold };
}

/* ---------- Seed ---------- */
const SEED_ACCOUNTS = [
  { id: "acct-admin", name: "Bechdou Admin", email: "admin@bechdou.pk", role: "admin", phone: "+92 300 0000000", city: "Lahore", handle: "@bechdouhq", trustScore: 100 },
  { id: "acct-seller", name: "Aiza Closet", email: "aiza@example.com", role: "seller", phone: "+92 321 1111111", city: "Lahore", handle: "@aizacloset", trustScore: 92 },
  { id: "acct-buyer", name: "Mina Buyer", email: "mina@example.com", role: "buyer", phone: "+92 333 2222222", city: "Karachi", handle: "@minabuyer", trustScore: 86 },
  { id: "acct-seller-noor", name: "Noor Vintage", email: "noor@example.com", role: "seller", phone: "+92 345 3334444", city: "Islamabad", handle: "@noorvintage", trustScore: 89 },
];

const SEED_LISTINGS = [
  { id: "lst-blue-top", title: "Powder blue ruched top", brand: "Zara", price: 1450, retail_price: 3900, category: "Tops", size: "S", condition: "Like new", location: "Lahore", color: "Powder blue", fabric: "Cotton blend", measurements: "Bust 32 in, length 18 in", flaws: "No visible flaws", seller_id: "acct-seller", seller_name: "Aiza Closet", description: "Soft summer top with a clean fit and merlot bag styling.", image: "./assets/listing-blue-top.png", status: "approved", front_photo: 1, back_photo: 1, label_photo: 1, measurements_check: 1, views: 148, created_at: "2026-06-02T08:30:00.000Z" },
  { id: "lst-merlot-blouse", title: "Merlot satin blouse", brand: "Mango", price: 2200, retail_price: 6400, category: "Tops", size: "M", condition: "Lightly worn", location: "Islamabad", color: "Deep merlot", fabric: "Satin", measurements: "Bust 36 in, length 23 in", flaws: "Tiny pull near left cuff", seller_id: "acct-seller", seller_name: "Aiza Closet", description: "Deep merlot sheen, easy evening piece, one small cuff pull.", image: "./assets/listing-merlot-blouse.png", status: "approved", front_photo: 1, back_photo: 1, label_photo: 0, measurements_check: 1, views: 203, created_at: "2026-06-03T10:15:00.000Z" },
  { id: "lst-cardigan-flats", title: "Cardigan and ballet flats", brand: "Charles & Keith", price: 3900, retail_price: 9500, category: "Shoes", size: "38", condition: "Brand new", location: "Karachi", color: "Cream", fabric: "Faux leather", measurements: "EU 38, heel 0.5 in", flaws: "Unworn", seller_id: "acct-seller-noor", seller_name: "Noor Vintage", description: "Cream flats paired with a powder blue cardigan set.", image: "./assets/listing-cardigan-flats.png", status: "approved", front_photo: 1, back_photo: 1, label_photo: 1, measurements_check: 1, views: 121, created_at: "2026-06-04T07:45:00.000Z" },
  { id: "lst-linen-blazer", title: "Cream linen blazer", brand: "Massimo Dutti", price: 5200, retail_price: 18000, category: "Outerwear", size: "M", condition: "Like new", location: "Lahore", color: "Cream", fabric: "Linen blend", measurements: "Shoulder 15 in, length 27 in", flaws: "Freshly dry cleaned", seller_id: "acct-seller-noor", seller_name: "Noor Vintage", description: "Lightweight blazer with old-money structure and minimal wear.", image: FALLBACK_IMAGE, status: "approved", front_photo: 1, back_photo: 1, label_photo: 1, measurements_check: 1, views: 96, created_at: "2026-06-05T12:20:00.000Z" },
  { id: "lst-pending-bag", title: "Cherry shoulder bag", brand: "Local boutique", price: 2600, retail_price: 5200, category: "Accessories", size: "One size", condition: "Like new", location: "Lahore", color: "Merlot", fabric: "Patent faux leather", measurements: "9 x 5 in", flaws: "Light hardware scratches", seller_id: "acct-seller", seller_name: "Aiza Closet", description: "Structured mini shoulder bag with a glossy merlot finish.", image: FALLBACK_IMAGE, status: "pending", front_photo: 1, back_photo: 0, label_photo: 0, measurements_check: 1, views: 34, created_at: "2026-06-05T14:20:00.000Z" },
];

const SEED_SAVES = [
  ["acct-admin", "lst-blue-top"],
  ["acct-buyer", "lst-merlot-blouse"],
  ["acct-buyer", "lst-cardigan-flats"],
  ["acct-seller-noor", "lst-blue-top"],
];

const SEED_ORDERS = [
  { id: "ord-seed-1", listing_id: "lst-merlot-blouse", buyer_id: "acct-buyer", buyer_name: "Mina Buyer", seller_id: "acct-seller", contact: "+92 333 2222222", delivery_city: "Karachi", note: "Please confirm cuff condition before dispatch.", amount: 2200, commission_amount: 440, payout_amount: 1760, payment_method: "jazzcash", payment_status: "Paid", payment_reference: "JC-44921", status: "QC passed", created_at: "2026-06-06T11:10:00.000Z", updated_at: "2026-06-06T15:40:00.000Z" },
];

const SEED_EVENTS = [
  { id: "evt-seed-1", type: "payment", message: "JazzCash payment verified for Merlot satin blouse.", actor_id: "acct-admin", entity_id: "ord-seed-1", created_at: "2026-06-06T15:40:00.000Z" },
  { id: "evt-seed-2", type: "listing", message: "Cream linen blazer approved for the public drop.", actor_id: "acct-admin", entity_id: "lst-linen-blazer", created_at: "2026-06-05T16:05:00.000Z" },
];

export function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;
  if (count > 0) return false;
  reseed();
  return true;
}

export function reseed() {
  // node:sqlite has no .transaction() helper — use manual BEGIN/COMMIT.
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM saves; DELETE FROM orders; DELETE FROM events; DELETE FROM listings; DELETE FROM accounts;");
    const insAcc = db.prepare(
      `INSERT INTO accounts (id,name,email,password_hash,role,phone,city,handle,trust_score,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const a of SEED_ACCOUNTS) {
      insAcc.run(a.id, a.name, a.email, hashPassword(DEMO_PASSWORD), a.role, a.phone, a.city, a.handle, a.trustScore, "2026-06-01T08:00:00.000Z");
    }
    const insLst = db.prepare(
      `INSERT INTO listings (id,title,brand,price,retail_price,category,size,condition,location,color,fabric,
        measurements,flaws,seller_id,seller_name,description,image,status,front_photo,back_photo,label_photo,
        measurements_check,views,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const l of SEED_LISTINGS) {
      insLst.run(l.id, l.title, l.brand, l.price, l.retail_price, l.category, l.size, l.condition, l.location,
        l.color, l.fabric, l.measurements, l.flaws, l.seller_id, l.seller_name, l.description, l.image, l.status,
        l.front_photo, l.back_photo, l.label_photo, l.measurements_check, l.views, l.created_at, l.created_at);
    }
    const insSave = db.prepare("INSERT INTO saves (account_id, listing_id) VALUES (?, ?)");
    for (const [acc, lst] of SEED_SAVES) insSave.run(acc, lst);
    const insOrd = db.prepare(
      `INSERT INTO orders (id,listing_id,buyer_id,buyer_name,seller_id,contact,delivery_city,note,amount,
        commission_amount,payout_amount,payment_method,payment_status,payment_reference,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const o of SEED_ORDERS) {
      insOrd.run(o.id, o.listing_id, o.buyer_id, o.buyer_name, o.seller_id, o.contact, o.delivery_city, o.note,
        o.amount, o.commission_amount, o.payout_amount, o.payment_method, o.payment_status, o.payment_reference,
        o.status, o.created_at, o.updated_at);
    }
    const insEvt = db.prepare("INSERT INTO events (id,type,message,actor_id,entity_id,created_at) VALUES (?,?,?,?,?,?)");
    for (const e of SEED_EVENTS) insEvt.run(e.id, e.type, e.message, e.actor_id, e.entity_id, e.created_at);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
