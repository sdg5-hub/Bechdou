const STORAGE_KEY = "bechdou-mvp-marketplace-v1";
const FALLBACK_IMAGE = "./assets/bechdou-editorial-collage.png";
const DEMO_PASSWORD = "bechdou123";
const COMMISSION_RATE = 0.15;

const paymentOptions = [
  {
    id: "stripe-checkout",
    label: "Stripe Checkout",
    status: "Payment core",
    note: "Hosted Stripe payment page for buyer checkout; card data never touches Bechdou servers.",
    disabled: false,
  },
  {
    id: "stripe-shipping",
    label: "Stripe shipping rates",
    status: "Delivery fee",
    note: "Checkout can collect shipping address and shipping rates; Bechdou still owns courier fulfillment.",
    disabled: true,
    checkout: false,
  },
  {
    id: "stripe-connect",
    label: "Stripe Connect",
    status: "Payouts",
    note: "Marketplace pattern for seller onboarding, application fees, and seller payouts.",
    disabled: true,
    checkout: false,
  },
  {
    id: "manual-admin",
    label: "Admin assisted checkout",
    status: "Fallback",
    note: "Temporary admin-created order route if a buyer cannot complete Stripe checkout.",
    disabled: false,
  },
  {
    id: "wallet-transfer",
    label: "Legacy wallet transfer",
    status: "Legacy demo",
    note: "Kept only so older local demo orders still display correctly.",
    disabled: true,
    checkout: false,
  },
];

const ceoQuestions = [
  "How do we raise first-30-day sell-through without lowering listing quality?",
  "What seller activation loop gets random public sellers to their first sale fastest?",
  "What checkout, QC, and delivery promise makes random buyers trust open-marketplace sellers?",
  "What commission and Stripe Connect payout model protects Bechdou margin while sellers still feel liquid?",
  "Which circularity metric should sit beside GMV in every investor and brand narrative?",
];

function hashPassword(password) {
  const text = String(password || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `demo-${(hash >>> 0).toString(16)}`;
}

function legacyPasswordHash(password) {
  try {
    return btoa(unescape(encodeURIComponent(String(password || ""))));
  } catch (error) {
    return "";
  }
}

const seedState = {
  accounts: [
    {
      id: "acct-admin",
      name: "Bechdou Admin",
      email: "admin@bechdou.pk",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "admin",
      phone: "+92 300 0000000",
      city: "Lahore",
      handle: "@bechdouhq",
      trustScore: 100,
      savedListingIds: ["lst-blue-top"],
      createdAt: "2026-06-01T08:00:00.000Z",
    },
    {
      id: "acct-seller",
      name: "Aiza Closet",
      email: "aiza@example.com",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "seller",
      phone: "+92 321 1111111",
      city: "Lahore",
      handle: "@aizacloset",
      trustScore: 92,
      savedListingIds: [],
      createdAt: "2026-06-01T08:05:00.000Z",
    },
    {
      id: "acct-buyer",
      name: "Mina Buyer",
      email: "mina@example.com",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "buyer",
      phone: "+92 333 2222222",
      city: "Karachi",
      handle: "@minabuyer",
      trustScore: 86,
      savedListingIds: ["lst-merlot-blouse", "lst-cardigan-flats"],
      createdAt: "2026-06-01T08:10:00.000Z",
    },
    {
      id: "acct-seller-noor",
      name: "Noor Vintage",
      email: "noor@example.com",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "seller",
      phone: "+92 345 3334444",
      city: "Islamabad",
      handle: "@noorvintage",
      trustScore: 89,
      savedListingIds: ["lst-blue-top"],
      createdAt: "2026-06-01T09:30:00.000Z",
    },
  ],
  currentUserId: "acct-buyer",
  listings: [
    {
      id: "lst-blue-top",
      title: "Powder blue ruched top",
      brand: "Zara",
      price: 1450,
      retailPrice: 3900,
      category: "Tops",
      size: "S",
      condition: "Like new",
      location: "Lahore",
      color: "Powder blue",
      fabric: "Cotton blend",
      measurements: "Bust 32 in, length 18 in",
      flaws: "No visible flaws",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Soft summer top with a clean fit and merlot bag styling.",
      image: "./assets/listing-blue-top.png",
      status: "approved",
      qualityChecks: {
        frontPhoto: true,
        backPhoto: true,
        labelPhoto: true,
        measurements: true,
      },
      views: 148,
      savedBy: ["acct-admin"],
      createdAt: "2026-06-02T08:30:00.000Z",
    },
    {
      id: "lst-merlot-blouse",
      title: "Merlot satin blouse",
      brand: "Mango",
      price: 2200,
      retailPrice: 6400,
      category: "Tops",
      size: "M",
      condition: "Lightly worn",
      location: "Islamabad",
      color: "Deep merlot",
      fabric: "Satin",
      measurements: "Bust 36 in, length 23 in",
      flaws: "Tiny pull near left cuff",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Deep merlot sheen, easy evening piece, one small cuff pull.",
      image: "./assets/listing-merlot-blouse.png",
      status: "approved",
      qualityChecks: {
        frontPhoto: true,
        backPhoto: true,
        labelPhoto: false,
        measurements: true,
      },
      views: 203,
      savedBy: ["acct-buyer"],
      createdAt: "2026-06-03T10:15:00.000Z",
    },
    {
      id: "lst-cardigan-flats",
      title: "Cardigan and ballet flats",
      brand: "Charles & Keith",
      price: 3900,
      retailPrice: 9500,
      category: "Shoes",
      size: "38",
      condition: "Brand new",
      location: "Karachi",
      color: "Cream",
      fabric: "Faux leather",
      measurements: "EU 38, heel 0.5 in",
      flaws: "Unworn",
      sellerId: "acct-seller-noor",
      sellerName: "Noor Vintage",
      description: "Cream flats paired with a powder blue cardigan set.",
      image: "./assets/listing-cardigan-flats.png",
      status: "approved",
      qualityChecks: {
        frontPhoto: true,
        backPhoto: true,
        labelPhoto: true,
        measurements: true,
      },
      views: 121,
      savedBy: ["acct-buyer"],
      createdAt: "2026-06-04T07:45:00.000Z",
    },
    {
      id: "lst-linen-blazer",
      title: "Cream linen blazer",
      brand: "Massimo Dutti",
      price: 5200,
      retailPrice: 18000,
      category: "Outerwear",
      size: "M",
      condition: "Like new",
      location: "Lahore",
      color: "Cream",
      fabric: "Linen blend",
      measurements: "Shoulder 15 in, length 27 in",
      flaws: "Freshly dry cleaned",
      sellerId: "acct-seller-noor",
      sellerName: "Noor Vintage",
      description: "Lightweight blazer with old-money structure and minimal wear.",
      image: FALLBACK_IMAGE,
      status: "approved",
      qualityChecks: {
        frontPhoto: true,
        backPhoto: true,
        labelPhoto: true,
        measurements: true,
      },
      views: 96,
      savedBy: [],
      createdAt: "2026-06-05T12:20:00.000Z",
    },
    {
      id: "lst-pending-bag",
      title: "Cherry shoulder bag",
      brand: "Local boutique",
      price: 2600,
      retailPrice: 5200,
      category: "Accessories",
      size: "One size",
      condition: "Like new",
      location: "Lahore",
      color: "Merlot",
      fabric: "Patent faux leather",
      measurements: "9 x 5 in",
      flaws: "Light hardware scratches",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Structured mini shoulder bag with a glossy merlot finish.",
      image: FALLBACK_IMAGE,
      status: "pending",
      qualityChecks: {
        frontPhoto: true,
        backPhoto: false,
        labelPhoto: false,
        measurements: true,
      },
      views: 34,
      savedBy: [],
      createdAt: "2026-06-05T14:20:00.000Z",
    },
  ],
  orders: [
    {
      id: "ord-seed-1",
      listingId: "lst-merlot-blouse",
      buyerId: "acct-buyer",
      buyerName: "Mina Buyer",
      contact: "+92 333 2222222",
      deliveryCity: "Karachi",
      note: "Please confirm cuff condition before dispatch.",
      amount: 2200,
      paymentMethod: "wallet-transfer",
      paymentStatus: "Paid",
      paymentReference: "JC-44921",
      status: "QC passed",
      createdAt: "2026-06-06T11:10:00.000Z",
      updatedAt: "2026-06-06T15:40:00.000Z",
    },
  ],
  auditLog: [
    {
      id: "evt-seed-1",
      type: "payment",
      message: "Wallet transfer verified for Merlot satin blouse.",
      actorId: "acct-admin",
      entityId: "ord-seed-1",
      createdAt: "2026-06-06T15:40:00.000Z",
    },
    {
      id: "evt-seed-2",
      type: "listing",
      message: "Cream linen blazer approved for the public drop.",
      actorId: "acct-admin",
      entityId: "lst-linen-blazer",
      createdAt: "2026-06-05T16:05:00.000Z",
    },
  ],
  selectedListingId: "",
};

let state = loadState();
let filters = {
  category: "all",
  search: "",
  city: "all",
  condition: "all",
  minPrice: "",
  maxPrice: "",
  sort: "newest",
  savedOnly: false,
};
let uploadedImageData = "";
let toastTimer = null;

const dom = {
  navButtons: document.querySelectorAll("[data-view-target]"),
  panels: document.querySelectorAll("[data-view-panel]"),
  categoryButtons: document.querySelectorAll("[data-category]"),
  authModeButtons: document.querySelectorAll("[data-auth-mode]"),
  authPanels: document.querySelectorAll("[data-auth-panel]"),
  topStatus: document.getElementById("top-status"),
  approvedCount: document.getElementById("approved-count"),
  requestCount: document.getElementById("request-count"),
  accountCount: document.getElementById("account-count"),
  activeUserCard: document.getElementById("active-user-card"),
  marketMetrics: document.getElementById("market-metrics"),
  roleDashboardTitle: document.getElementById("role-dashboard-title"),
  roleDashboard: document.getElementById("role-dashboard"),
  activityFeed: document.getElementById("activity-feed"),
  ceoQuestions: document.getElementById("ceo-questions"),
  sessionSummary: document.getElementById("session-summary"),
  paymentSummary: document.getElementById("payment-summary"),
  opsSummary: document.getElementById("ops-summary"),
  signupForm: document.getElementById("signup-form"),
  loginForm: document.getElementById("login-form"),
  currentAccount: document.getElementById("current-account"),
  searchInput: document.getElementById("search-input"),
  filterCity: document.getElementById("filter-city"),
  filterCondition: document.getElementById("filter-condition"),
  filterMinPrice: document.getElementById("filter-min-price"),
  filterMaxPrice: document.getElementById("filter-max-price"),
  filterSort: document.getElementById("filter-sort"),
  filterSaved: document.getElementById("filter-saved"),
  resultsBar: document.getElementById("results-bar"),
  listingGrid: document.getElementById("listing-grid"),
  orderForm: document.getElementById("order-form"),
  requestEmpty: document.getElementById("request-empty"),
  requestSelected: document.getElementById("request-selected"),
  orderName: document.getElementById("order-name"),
  orderContact: document.getElementById("order-contact"),
  orderPaymentMethod: document.getElementById("order-payment-method"),
  orderPaymentReference: document.getElementById("order-payment-reference"),
  orderDeliveryCity: document.getElementById("order-delivery-city"),
  orderNote: document.getElementById("order-note"),
  listingForm: document.getElementById("listing-form"),
  imageFile: document.getElementById("listing-image-file"),
  imagePreview: document.getElementById("image-preview"),
  sellerMetrics: document.getElementById("seller-metrics"),
  listingAssistant: document.getElementById("listing-assistant"),
  sellerListings: document.getElementById("seller-listings"),
  pendingListings: document.getElementById("pending-listings"),
  orderList: document.getElementById("order-list"),
  accountTable: document.getElementById("account-table"),
  ledgerList: document.getElementById("ledger-list"),
  sellerRoleNote: document.getElementById("seller-role-note"),
  adminRoleNote: document.getElementById("admin-role-note"),
  adminKpis: document.getElementById("admin-kpis"),
  resetDemo: document.getElementById("reset-demo"),
  toast: document.getElementById("toast"),
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeState(saved ? JSON.parse(saved) : structuredClone(seedState));
  } catch (error) {
    return structuredClone(seedState);
  }
}

function normalizeState(value) {
  const next = {
    accounts: Array.isArray(value?.accounts) ? value.accounts : [],
    currentUserId: value?.currentUserId ?? seedState.currentUserId,
    listings: Array.isArray(value?.listings) ? value.listings : structuredClone(seedState.listings),
    orders: Array.isArray(value?.orders) ? value.orders : [],
    auditLog: Array.isArray(value?.auditLog) ? value.auditLog : [],
    selectedListingId: value?.selectedListingId || "",
  };

  next.accounts = mergeSeedRecords(next.accounts, seedState.accounts).map(normalizeAccount);
  next.listings = mergeSeedRecords(next.listings, seedState.listings).map(normalizeListing);
  next.orders = mergeSeedRecords(next.orders, seedState.orders).map((order) => normalizeOrder(order, next));
  next.auditLog = mergeSeedRecords(next.auditLog, seedState.auditLog).map(normalizeEvent).slice(0, 60);

  if (next.currentUserId && !next.accounts.some((account) => account.id === next.currentUserId)) {
    next.currentUserId = "";
  }

  syncListingSaves(next);
  return next;
}

function mergeSeedRecords(records, seedRecords) {
  const result = Array.isArray(records) ? records.map((record) => ({ ...record })) : [];
  seedRecords.forEach((seedRecord) => {
    if (!result.some((record) => record.id === seedRecord.id)) {
      result.push(structuredClone(seedRecord));
    }
  });
  return result;
}

function normalizeAccount(account) {
  const email = normalizeEmail(account.email);
  return {
    id: account.id || makeId("acct"),
    name: account.name || "Bechdou User",
    email,
    passwordHash: account.passwordHash || hashPassword(DEMO_PASSWORD),
    role: ["buyer", "seller", "admin"].includes(account.role) ? account.role : "buyer",
    phone: account.phone || "",
    city: account.city || "Pakistan",
    handle: account.handle || handleFromName(account.name || email || "user"),
    trustScore: clamp(Number(account.trustScore || 78), 40, 100),
    savedListingIds: Array.isArray(account.savedListingIds) ? unique(account.savedListingIds) : [],
    createdAt: account.createdAt || new Date().toISOString(),
  };
}

function normalizeListing(listing) {
  return {
    id: listing.id || makeId("lst"),
    title: listing.title || "Untitled piece",
    brand: listing.brand || "Unbranded",
    price: Number(listing.price || 0),
    retailPrice: Number(listing.retailPrice || listing.originalPrice || listing.price || 0),
    category: listing.category || "Tops",
    size: listing.size || "One size",
    condition: listing.condition || "Like new",
    location: listing.location || "Pakistan",
    color: listing.color || "",
    fabric: listing.fabric || "",
    measurements: listing.measurements || "",
    flaws: listing.flaws || "Not specified",
    sellerId: listing.sellerId || "acct-seller",
    sellerName: listing.sellerName || "Bechdou Seller",
    description: listing.description || "",
    image: listing.image || FALLBACK_IMAGE,
    status: listing.status || "pending",
    qualityChecks: normalizeQualityChecks(listing.qualityChecks || listing),
    qualityScore: Number(listing.qualityScore || 0),
    views: Number(listing.views || 0),
    savedBy: Array.isArray(listing.savedBy) ? unique(listing.savedBy) : [],
    adminNote: listing.adminNote || "",
    createdAt: listing.createdAt || new Date().toISOString(),
    updatedAt: listing.updatedAt || listing.createdAt || new Date().toISOString(),
  };
}

function normalizeQualityChecks(source) {
  return {
    frontPhoto: Boolean(source.frontPhoto ?? source.hasFrontPhoto ?? true),
    backPhoto: Boolean(source.backPhoto ?? source.hasBackPhoto ?? false),
    labelPhoto: Boolean(source.labelPhoto ?? source.hasLabelPhoto ?? false),
    measurements: Boolean(source.measurements ?? source.hasMeasurements ?? false),
  };
}

function normalizeOrder(order, sourceState = state) {
  const listing = listingById(order.listingId, sourceState);
  const buyer = sourceState.accounts?.find((account) => account.id === order.buyerId);
  return {
    id: order.id || makeId("ord"),
    listingId: order.listingId || "",
    buyerId: order.buyerId || "",
    buyerName: order.buyerName || buyer?.name || "Buyer",
    contact: order.contact || buyer?.phone || buyer?.email || "",
    deliveryCity: order.deliveryCity || buyer?.city || "",
    note: order.note || "",
    amount: Number(order.amount || listing?.price || 0),
    paymentMethod: order.paymentMethod || "wallet-transfer",
    paymentStatus: order.paymentStatus || "Awaiting payment",
    paymentReference: order.paymentReference || "",
    status: order.status || "Requested",
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || order.createdAt || new Date().toISOString(),
  };
}

function normalizeEvent(event) {
  return {
    id: event.id || makeId("evt"),
    type: event.type || "ops",
    message: event.message || "Marketplace activity recorded.",
    actorId: event.actorId || "",
    entityId: event.entityId || "",
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

function syncListingSaves(sourceState = state) {
  const savedByListing = new Map();
  sourceState.accounts.forEach((account) => {
    account.savedListingIds = unique(account.savedListingIds || []);
    account.savedListingIds.forEach((listingId) => {
      if (!savedByListing.has(listingId)) savedByListing.set(listingId, []);
      savedByListing.get(listingId).push(account.id);
    });
  });

  sourceState.listings.forEach((listing) => {
    const savedBy = new Set([...(listing.savedBy || []), ...(savedByListing.get(listing.id) || [])]);
    listing.savedBy = Array.from(savedBy);
  });
}

function saveState() {
  syncListingSaves();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function handleFromName(value) {
  const base = String(value || "bechdou")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return `@${base || "bechdou"}`;
}

function activeAccount() {
  return state.accounts.find((account) => account.id === state.currentUserId) || null;
}

function accountById(id) {
  return state.accounts.find((account) => account.id === id) || null;
}

function listingById(id, sourceState = state) {
  return sourceState.listings.find((listing) => listing.id === id) || null;
}

function orderById(id) {
  return state.orders.find((order) => order.id === id) || null;
}

function canSell(account = activeAccount()) {
  return Boolean(account && ["seller", "admin"].includes(account.role));
}

function canAdmin(account = activeAccount()) {
  return account?.role === "admin";
}

function passwordMatches(account, password) {
  return account?.passwordHash === hashPassword(password) || account?.passwordHash === legacyPasswordHash(password);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeImage(value) {
  const src = String(value || "");
  if (src.startsWith("./assets/") || src.startsWith("data:image/") || /^https?:\/\//.test(src)) {
    return src;
  }
  return FALLBACK_IMAGE;
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function slugStatus(status) {
  return String(status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function statusClass(status) {
  return `status ${escapeHtml(slugStatus(status))}`;
}

function paymentOptionById(id) {
  return paymentOptions.find((option) => option.id === id) || paymentOptions[0];
}

function paymentLabel(id) {
  return paymentOptionById(id).label;
}

function payoutFor(amount) {
  return Math.round(Number(amount || 0) * (1 - COMMISSION_RATE));
}

function listingQualityScore(listing) {
  const checks = listing.qualityChecks || {};
  const dataScore = [
    listing.title,
    listing.brand && listing.brand !== "Unbranded",
    listing.price > 0,
    listing.retailPrice > 0,
    listing.description && listing.description.length > 28,
    listing.measurements,
    listing.flaws,
    listing.fabric,
    listing.color,
    safeImage(listing.image) !== FALLBACK_IMAGE,
  ].filter(Boolean).length;
  const checkScore = Object.values(checks).filter(Boolean).length;
  return clamp(Math.round(dataScore * 7 + checkScore * 8), 28, 100);
}

function orderIsOpen(order) {
  return !["Cancelled", "Delivered"].includes(order.status);
}

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) return 0;
  return Math.max(0, Math.round((endDate - startDate) / 86400000));
}

function listingAvailability(listingId) {
  const order = state.orders
    .filter((item) => item.listingId === listingId && item.status !== "Cancelled")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];

  if (!order) return { label: "Available", locked: false, order: null };
  if (order.status === "Delivered") return { label: "Sold", locked: true, order };
  return { label: "Reserved", locked: true, order };
}

function isSaved(listingId, account = activeAccount()) {
  return Boolean(account?.savedListingIds?.includes(listingId));
}

function marketplaceMetrics() {
  const approved = state.listings.filter((listing) => listing.status === "approved");
  const pending = state.listings.filter((listing) => listing.status === "pending");
  const rejected = state.listings.filter((listing) => listing.status === "rejected");
  const paidOrders = state.orders.filter((order) => order.paymentStatus === "Paid");
  const openOrders = state.orders.filter(orderIsOpen);
  const listedItems = state.listings.filter((listing) => listing.status !== "rejected");
  const sellerAccounts = state.accounts.filter((account) => account.role === "seller");
  const activeSellers = sellerAccounts.filter((account) =>
    state.listings.some((listing) => listing.sellerId === account.id),
  );
  const soldWithin30 = paidOrders.filter((order) => {
    const listing = listingById(order.listingId);
    return listing && daysBetween(listing.createdAt, order.createdAt) <= 30;
  });
  const soldListingIds = unique(paidOrders.map((order) => order.listingId));
  const paidBuyerIds = unique(paidOrders.map((order) => order.buyerId));
  const returningBuyerIds = paidBuyerIds.filter(
    (buyerId) => paidOrders.filter((order) => order.buyerId === buyerId).length > 1,
  );
  const firstSaleDurations = sellerAccounts
    .map((seller) => {
      const firstPaidOrder = paidOrders
        .filter((order) => listingById(order.listingId)?.sellerId === seller.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      return firstPaidOrder ? daysBetween(seller.createdAt, firstPaidOrder.createdAt) : null;
    })
    .filter((value) => value !== null);
  const totalGmv = paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const pendingGmv = openOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const qualityAverage = approved.length
    ? Math.round(approved.reduce((sum, listing) => sum + listingQualityScore(listing), 0) / approved.length)
    : 0;
  const saves = state.accounts.reduce((sum, account) => sum + account.savedListingIds.length, 0);

  return {
    approved: approved.length,
    pending: pending.length,
    rejected: rejected.length,
    orders: state.orders.length,
    openOrders: openOrders.length,
    paidOrders: paidOrders.length,
    totalGmv,
    pendingGmv,
    payoutDue: paidOrders.reduce((sum, order) => sum + payoutFor(order.amount), 0),
    sellThrough30: listedItems.length ? Math.round((soldWithin30.length / listedItems.length) * 100) : 0,
    timeToFirstSale: firstSaleDurations.length
      ? Math.round(firstSaleDurations.reduce((sum, days) => sum + days, 0) / firstSaleDurations.length)
      : 0,
    activeSellerRate: sellerAccounts.length ? Math.round((activeSellers.length / sellerAccounts.length) * 100) : 0,
    listingVelocity: listedItems.length,
    searchToBuyProxy: approved.length ? Math.round((paidOrders.length / approved.length) * 100) : 0,
    returnBuyerRate: paidBuyerIds.length ? Math.round((returningBuyerIds.length / paidBuyerIds.length) * 100) : 0,
    recirculatedItems: soldListingIds.length,
    qualityAverage,
    saves,
    sellers: state.accounts.filter((account) => ["seller", "admin"].includes(account.role)).length,
  };
}

function sellerMetrics(account = activeAccount()) {
  const sellerId = account?.id;
  const listings = state.listings.filter((listing) => listing.sellerId === sellerId || account?.role === "admin");
  const orders = state.orders.filter((order) => {
    const listing = listingById(order.listingId);
    return listing && (listing.sellerId === sellerId || account?.role === "admin");
  });
  const paidOrders = orders.filter((order) => order.paymentStatus === "Paid");
  const approved = listings.filter((listing) => listing.status === "approved");
  const pending = listings.filter((listing) => listing.status === "pending");
  const saves = listings.reduce((sum, listing) => sum + listing.savedBy.length, 0);

  return {
    listings,
    orders,
    approved: approved.length,
    pending: pending.length,
    saves,
    paidOrders: paidOrders.length,
    gross: paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
    payout: paidOrders.reduce((sum, order) => sum + payoutFor(order.amount), 0),
  };
}

function showToast(message) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
}

function switchView(view) {
  dom.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === view);
  });
  dom.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
}

function switchAuthMode(mode) {
  dom.authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  dom.authPanels.forEach((panel) => {
    const isActive = panel.dataset.authPanel === mode;
    panel.hidden = !isActive;
    panel.classList.toggle("is-hidden", !isActive);
  });
}

function setFormEnabled(form, enabled) {
  Array.from(form.elements).forEach((element) => {
    element.disabled = !enabled;
  });
}

function addEvent(type, message, entityId = "") {
  state.auditLog.unshift({
    id: makeId("evt"),
    type,
    message,
    actorId: state.currentUserId || "",
    entityId,
    createdAt: new Date().toISOString(),
  });
  state.auditLog = state.auditLog.slice(0, 60);
}

function renderCounts() {
  const metrics = marketplaceMetrics();
  dom.approvedCount.textContent = metrics.approved;
  dom.requestCount.textContent = metrics.orders;
  dom.accountCount.textContent = state.accounts.length;
  dom.topStatus.textContent = metrics.openOrders
    ? `${metrics.pending} pending / ${metrics.openOrders} active`
    : `${metrics.pending} pending`;

  dom.opsSummary.innerHTML = [
    ["GMV", money(metrics.totalGmv)],
    ["30-day sell-through", `${metrics.sellThrough30}%`],
    ["Active seller rate", `${metrics.activeSellerRate}%`],
    ["Recirculated", metrics.recirculatedItems],
    ["Pending review", metrics.pending],
  ]
    .map(
      ([label, value]) => `
        <div class="ops-row">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </div>
      `,
    )
    .join("");
}

function metricCard(label, value, caption, tone = "") {
  return `
    <article class="metric-card ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(caption)}</small>
    </article>
  `;
}

function renderMarketPulse() {
  const metrics = marketplaceMetrics();
  const account = activeAccount();

  dom.activeUserCard.innerHTML = account
    ? `
      <span class="${statusClass(account.role)}">${escapeHtml(account.role)}</span>
      <strong>${escapeHtml(account.name)}</strong>
      <small>${escapeHtml(account.city)} - ${escapeHtml(account.handle)}</small>
    `
    : `
      <span class="status pending">Signed out</span>
      <strong>No active session</strong>
      <small>Demo accounts remain available.</small>
    `;

  dom.marketMetrics.innerHTML = [
    metricCard("North Star GMV", money(metrics.totalGmv), `${metrics.paidOrders} completed checkout(s)`, "merlot"),
    metricCard("30-Day Sell-Through", `${metrics.sellThrough30}%`, "Leading indicator for GMV", "blue"),
    metricCard("Time to First Sale", `${metrics.timeToFirstSale || "--"}d`, "New seller liquidity", "cream"),
    metricCard("Recirculation", metrics.recirculatedItems, "Items kept in circulation", "merlot-soft"),
  ].join("");

  renderRoleDashboard(account);
  renderActivityFeed();
  renderCeoQuestions();
}

function renderRoleDashboard(account) {
  if (!account) {
    dom.roleDashboardTitle.textContent = "Signed-out console";
    dom.roleDashboard.innerHTML = `
      <div class="empty-state inline">
        <h3>No session</h3>
        <p>Log in with a seeded account or create a new profile.</p>
      </div>
    `;
    return;
  }

  if (account.role === "admin") {
    const metrics = marketplaceMetrics();
    dom.roleDashboardTitle.textContent = "Admin console";
    dom.roleDashboard.innerHTML = `
      <div class="mini-grid">
        ${metricCard("Review queue", metrics.pending, "Listings waiting")}
        ${metricCard("Orders", metrics.openOrders, "Active operations")}
        ${metricCard("Payout due", money(metrics.payoutDue), "Seller payable")}
      </div>
      <div class="action-row">
        <button class="button secondary" type="button" data-view-shortcut="admin">Open admin desk</button>
        <button class="button secondary" type="button" data-view-shortcut="browse">Audit public drop</button>
      </div>
    `;
    return;
  }

  if (account.role === "seller") {
    const metrics = sellerMetrics(account);
    dom.roleDashboardTitle.textContent = "Seller console";
    dom.roleDashboard.innerHTML = `
      <div class="mini-grid">
        ${metricCard("Approved", metrics.approved, "Live pieces")}
        ${metricCard("Pending", metrics.pending, "Under review")}
        ${metricCard("Payout", money(metrics.payout), "After marketplace fee")}
      </div>
      <div class="action-row">
        <button class="button secondary" type="button" data-view-shortcut="sell">Open seller studio</button>
        <button class="button secondary" type="button" data-view-shortcut="browse">View drop</button>
      </div>
    `;
    return;
  }

  const buyerOrders = state.orders.filter((order) => order.buyerId === account.id);
  dom.roleDashboardTitle.textContent = "Buyer console";
  dom.roleDashboard.innerHTML = `
    <div class="mini-grid">
      ${metricCard("Saved", account.savedListingIds.length, "Closet shortlist")}
      ${metricCard("Requests", buyerOrders.length, "Checkout history")}
      ${metricCard("City", account.city, "Delivery market")}
    </div>
    <div class="action-row">
      <button class="button secondary" type="button" data-view-shortcut="browse">Browse saved pieces</button>
      <button class="button secondary" type="button" data-set-saved-filter>Saved only</button>
    </div>
    ${buyerOrders.length ? `<div class="buyer-order-strip">${buyerOrders.slice(-3).map(buyerOrderPill).join("")}</div>` : ""}
  `;
}

function buyerOrderPill(order) {
  const listing = listingById(order.listingId);
  return `
    <div class="mini-record">
      <strong>${escapeHtml(listing?.title || "Requested item")}</strong>
      <span>${escapeHtml(order.status)} - ${escapeHtml(order.paymentStatus)}</span>
    </div>
  `;
}

function renderActivityFeed() {
  dom.activityFeed.innerHTML = state.auditLog.length
    ? state.auditLog
        .slice(0, 8)
        .map((event) => {
          const actor = accountById(event.actorId);
          return `
            <article class="activity-item">
              <span class="${statusClass(event.type)}">${escapeHtml(event.type)}</span>
              <strong>${escapeHtml(event.message)}</strong>
              <small>${escapeHtml(actor?.name || "System")} - ${escapeHtml(shortDate(event.createdAt))}</small>
            </article>
          `;
        })
        .join("")
    : `
      <div class="empty-state inline">
        <h3>No activity</h3>
        <p>Marketplace events appear here.</p>
      </div>
    `;
}

function renderCeoQuestions() {
  dom.ceoQuestions.innerHTML = ceoQuestions
    .map(
      (question, index) => `
        <article class="question-item">
          <span>${index + 1}</span>
          <strong>${escapeHtml(question)}</strong>
        </article>
      `,
    )
    .join("");
}

function renderSessionSummary() {
  const account = activeAccount();
  const permissions = account
    ? [
        "browse",
        account.role === "buyer" ? "request" : "",
        canSell(account) ? "sell" : "",
        canAdmin(account) ? "admin" : "",
      ].filter(Boolean)
    : ["browse"];

  dom.sessionSummary.innerHTML = `
    <div class="demo-credential">
      <strong>Demo password</strong>
      <code>${escapeHtml(DEMO_PASSWORD)}</code>
    </div>
    <div class="permission-row">
      ${permissions.map((permission) => `<span class="status ${escapeHtml(permission)}">${escapeHtml(permission)}</span>`).join("")}
    </div>
  `;
}

function renderPaymentSummary() {
  dom.paymentSummary.innerHTML = paymentOptions
    .map(
      (option) => `
        <article class="payment-route ${option.disabled ? "is-disabled" : ""}">
          <div>
            <strong>${escapeHtml(option.label)}</strong>
            <span>${escapeHtml(option.note)}</span>
          </div>
          <span class="${statusClass(option.status)}">${escapeHtml(option.status)}</span>
        </article>
      `,
    )
    .join("");
}

function renderAccount() {
  const account = activeAccount();

  if (!account) {
    dom.currentAccount.hidden = false;
    dom.currentAccount.innerHTML = `
      <span class="status pending">Signed out</span>
      <p class="status-note">Create an account or log in.</p>
    `;
    return;
  }

  dom.currentAccount.hidden = false;
  dom.currentAccount.innerHTML = `
    <div class="account-card-head">
      <span class="${statusClass(account.role)}">${escapeHtml(account.role)}</span>
      <button class="mini-button" type="button" data-logout>Log out</button>
    </div>
    <strong>${escapeHtml(account.name)}</strong>
    <span>${escapeHtml(account.email)}</span>
    <span>${escapeHtml(account.phone || "No phone")} - ${escapeHtml(account.city || "Pakistan")}</span>
    <label class="account-switch">
      Switch demo account
      <select data-account-switch>
        ${state.accounts
          .map(
            (item) => `
              <option value="${escapeHtml(item.id)}" ${item.id === account.id ? "selected" : ""}>
                ${escapeHtml(item.name)} (${escapeHtml(item.role)})
              </option>
            `,
          )
          .join("")}
      </select>
    </label>
  `;
}

function renderFilterOptions() {
  const currentCity = dom.filterCity.value || filters.city;
  const currentCondition = dom.filterCondition.value || filters.condition;
  const approved = state.listings.filter((listing) => listing.status === "approved");
  const cities = unique(approved.map((listing) => listing.location)).sort();
  const conditions = unique(approved.map((listing) => listing.condition)).sort();

  dom.filterCity.innerHTML = [
    `<option value="all">All cities</option>`,
    ...cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`),
  ].join("");
  dom.filterCondition.innerHTML = [
    `<option value="all">All condition</option>`,
    ...conditions.map((condition) => `<option value="${escapeHtml(condition)}">${escapeHtml(condition)}</option>`),
  ].join("");

  dom.filterCity.value = cities.includes(currentCity) ? currentCity : "all";
  dom.filterCondition.value = conditions.includes(currentCondition) ? currentCondition : "all";
}

function approvedListings() {
  const account = activeAccount();
  const minPrice = Number(filters.minPrice || 0);
  const maxPrice = Number(filters.maxPrice || 0);

  const listings = state.listings
    .filter((listing) => listing.status === "approved")
    .filter((listing) => filters.category === "all" || listing.category === filters.category)
    .filter((listing) => filters.city === "all" || listing.location === filters.city)
    .filter((listing) => filters.condition === "all" || listing.condition === filters.condition)
    .filter((listing) => !minPrice || listing.price >= minPrice)
    .filter((listing) => !maxPrice || listing.price <= maxPrice)
    .filter((listing) => !filters.savedOnly || isSaved(listing.id, account))
    .filter((listing) => {
      if (!filters.search) return true;
      const haystack = [
        listing.title,
        listing.brand,
        listing.sellerName,
        listing.category,
        listing.size,
        listing.condition,
        listing.location,
        listing.color,
        listing.fabric,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(filters.search);
    });

  return listings.sort((a, b) => {
    if (filters.sort === "price-low") return a.price - b.price;
    if (filters.sort === "price-high") return b.price - a.price;
    if (filters.sort === "quality") return listingQualityScore(b) - listingQualityScore(a);
    if (filters.sort === "saved") return b.savedBy.length - a.savedBy.length;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function listingCard(listing) {
  const saved = isSaved(listing.id);
  const availability = listingAvailability(listing.id);
  const quality = listingQualityScore(listing);
  const discount = listing.retailPrice > listing.price ? Math.round((1 - listing.price / listing.retailPrice) * 100) : 0;

  return `
    <article class="listing-card">
      <div class="listing-media">
        <img src="${escapeHtml(safeImage(listing.image))}" alt="${escapeHtml(listing.title)}" />
        <span class="badge">${escapeHtml(listing.category)}</span>
        <button
          class="save-button ${saved ? "is-saved" : ""}"
          type="button"
          data-toggle-save="${escapeHtml(listing.id)}"
          aria-pressed="${saved ? "true" : "false"}"
        >
          ${saved ? "Saved" : "Save"}
        </button>
      </div>
      <div class="listing-body">
        <div class="listing-title-row">
          <h3>${escapeHtml(listing.title)}</h3>
          <span class="price">${escapeHtml(money(listing.price))}</span>
        </div>
        <p class="listing-meta">
          <span>${escapeHtml(listing.brand)}</span>
          <span>${escapeHtml(listing.size || "One size")}</span>
          <span>${escapeHtml(listing.condition)}</span>
          <span>${escapeHtml(listing.location || "Pakistan")}</span>
        </p>
        <p class="listing-description">${escapeHtml(listing.description)}</p>
        <div class="quality-row">
          <span class="${statusClass(availability.label)}">${escapeHtml(availability.label)}</span>
          <span>${quality}% QC</span>
          ${discount ? `<span>${discount}% below retail</span>` : ""}
        </div>
        <div class="listing-actions">
          <button class="button secondary" type="button" data-request-id="${escapeHtml(listing.id)}" ${
            availability.locked ? "disabled" : ""
          }>
            Request checkout
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderBrowse() {
  renderFilterOptions();
  const listings = approvedListings();
  dom.resultsBar.innerHTML = `
    <span>${listings.length} result${listings.length === 1 ? "" : "s"}</span>
    <span>${filters.savedOnly ? "Saved filter on" : "Full drop"}</span>
  `;
  dom.listingGrid.innerHTML = listings.length
    ? listings.map(listingCard).join("")
    : `
      <div class="empty-state">
        <p class="script-label small">Drop</p>
        <h3>No approved pieces</h3>
        <p>Try another category or approve a pending listing.</p>
      </div>
    `;
}

function renderPaymentMethodOptions(selectedMethod = dom.orderPaymentMethod.value) {
  const checkoutOptions = paymentOptions.filter((option) => option.checkout !== false);
  dom.orderPaymentMethod.innerHTML = checkoutOptions
    .map(
      (option) => `
        <option value="${escapeHtml(option.id)}" ${option.disabled ? "disabled" : ""} ${
          option.id === selectedMethod ? "selected" : ""
        }>
          ${escapeHtml(option.label)}${option.disabled ? " (disabled)" : ""}
        </option>
      `,
    )
    .join("");

  if (dom.orderPaymentMethod.selectedOptions[0]?.disabled) {
    dom.orderPaymentMethod.value = checkoutOptions.find((option) => !option.disabled)?.id || "";
  }
}

function renderRequestPanel() {
  const listing = listingById(state.selectedListingId);
  const account = activeAccount();

  dom.requestEmpty.hidden = Boolean(listing);
  dom.orderForm.hidden = !listing;
  dom.requestEmpty.classList.toggle("is-hidden", Boolean(listing));
  dom.orderForm.classList.toggle("is-hidden", !listing);

  if (!listing) return;

  renderPaymentMethodOptions();
  const quality = listingQualityScore(listing);

  dom.requestSelected.innerHTML = `
    <span class="status approved">Selected</span>
    <strong>${escapeHtml(listing.title)}</strong>
    <p>${escapeHtml(money(listing.price))} - ${escapeHtml(listing.sellerName)}</p>
    <div class="request-detail-grid">
      <span>${escapeHtml(listing.brand)}</span>
      <span>${escapeHtml(listing.size)}</span>
      <span>${escapeHtml(listing.condition)}</span>
      <span>${quality}% QC</span>
    </div>
  `;

  if (account && !dom.orderName.value) dom.orderName.value = account.name;
  if (account && !dom.orderContact.value) dom.orderContact.value = account.phone || account.email;
  if (account && !dom.orderDeliveryCity.value) dom.orderDeliveryCity.value = account.city || "";
}

function queueItem(listing, options = {}) {
  const quality = listingQualityScore(listing);
  const actions = options.actions
    ? `
      <div class="queue-actions">
        ${options.actions
          .map(
            (action) => `
              <button
                class="mini-button ${escapeHtml(action.kind || "")}"
                type="button"
                data-${escapeHtml(action.name)}="${escapeHtml(listing.id)}"
              >
                ${escapeHtml(action.label)}
              </button>
            `,
          )
          .join("")}
      </div>
    `
    : "";

  return `
    <article class="queue-item">
      <img src="${escapeHtml(safeImage(listing.image))}" alt="${escapeHtml(listing.title)}" />
      <div class="queue-copy">
        <div class="status-row">
          <span class="${statusClass(listing.status)}">${escapeHtml(listing.status)}</span>
          <span class="status quality">${quality}% QC</span>
        </div>
        <h4>${escapeHtml(listing.title)}</h4>
        <p class="queue-meta">${escapeHtml(money(listing.price))} - ${escapeHtml(listing.brand)} - ${escapeHtml(listing.sellerName)}</p>
        <p class="queue-meta">${escapeHtml(listing.flaws || "No flaws listed")}</p>
        ${actions}
      </div>
    </article>
  `;
}

function renderSellerMetrics() {
  const account = activeAccount();
  const allowed = canSell(account);

  if (!allowed) {
    dom.sellerMetrics.innerHTML = `
      ${metricCard("Seller access", "Locked", "Use a seller or admin account")}
      ${metricCard("Demo sellers", "2", "Aiza Closet and Noor Vintage")}
      ${metricCard("Password", DEMO_PASSWORD, "Seeded account login")}
    `;
    return;
  }

  const metrics = sellerMetrics(account);
  dom.sellerMetrics.innerHTML = [
    metricCard("Live", metrics.approved, "Approved listings"),
    metricCard("Pending", metrics.pending, "Review queue"),
    metricCard("Demand", metrics.saves, "Saved by buyers"),
    metricCard("Payout", money(metrics.payout), "After marketplace fee"),
  ].join("");
}

function listingScoreFromForm() {
  const form = new FormData(dom.listingForm);
  const pseudoListing = {
    title: String(form.get("title") || ""),
    brand: String(form.get("brand") || ""),
    price: Number(form.get("price") || 0),
    retailPrice: Number(form.get("retailPrice") || 0),
    description: String(form.get("description") || ""),
    measurements: String(form.get("measurements") || ""),
    flaws: String(form.get("flaws") || ""),
    fabric: String(form.get("fabric") || ""),
    color: String(form.get("color") || ""),
    image: uploadedImageData || String(form.get("imageUrl") || ""),
    qualityChecks: {
      frontPhoto: form.get("hasFrontPhoto") === "on",
      backPhoto: form.get("hasBackPhoto") === "on",
      labelPhoto: form.get("hasLabelPhoto") === "on",
      measurements: form.get("hasMeasurements") === "on" || Boolean(String(form.get("measurements") || "")),
    },
  };
  return listingQualityScore(pseudoListing);
}

function renderListingAssistant() {
  const score = listingScoreFromForm();
  const grade = score >= 82 ? "Drop-ready" : score >= 64 ? "Needs polish" : "Thin listing";
  dom.listingAssistant.innerHTML = `
    <div class="quality-card">
      <span class="${statusClass(grade)}">${escapeHtml(grade)}</span>
      <strong>${score}% listing score</strong>
      <div class="meter"><span style="width: ${score}%"></span></div>
    </div>
  `;
}

function renderSellerQueue() {
  const account = activeAccount();
  const sellerAllowed = canSell(account);

  setFormEnabled(dom.listingForm, sellerAllowed);
  dom.sellerRoleNote.innerHTML = sellerAllowed
    ? `<span class="status approved">Seller ready</span>`
    : `<span class="status pending">Seller login required</span>`;

  renderSellerMetrics();
  renderListingAssistant();

  const listings = state.listings
    .filter((listing) => account && (listing.sellerId === account.id || account.role === "admin"))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  dom.sellerListings.innerHTML = listings.length
    ? listings.map((listing) => queueItem(listing)).join("")
    : `
      <div class="empty-state">
        <h3>No listings yet</h3>
        <p>Submitted pieces appear here after seller login.</p>
      </div>
    `;
}

function renderAdminKpis(adminAllowed) {
  const metrics = marketplaceMetrics();
  dom.adminKpis.innerHTML = adminAllowed
    ? [
        metricCard("GMV", money(metrics.totalGmv), "North-star value"),
        metricCard("Sell-through", `${metrics.sellThrough30}%`, "First 30 days"),
        metricCard("Active sellers", `${metrics.activeSellerRate}%`, "Supply health"),
        metricCard("Seller payout", money(metrics.payoutDue), "Stripe Connect target"),
      ].join("")
    : [
        metricCard("Admin", "Locked", "Admin account required"),
        metricCard("Seed login", "admin@bechdou.pk", "Password in access panel"),
      ].join("");
}

function renderAdmin() {
  const account = activeAccount();
  const adminAllowed = canAdmin(account);

  dom.adminRoleNote.innerHTML = adminAllowed
    ? `<span class="status approved">Admin active</span>`
    : `<span class="status pending">Admin login required</span>`;

  renderAdminKpis(adminAllowed);

  if (!adminAllowed) {
    const locked = `
      <div class="empty-state">
        <h3>Admin login required</h3>
        <p>Admin operations are role-gated.</p>
      </div>
    `;
    dom.pendingListings.innerHTML = locked;
    dom.orderList.innerHTML = locked;
    dom.accountTable.innerHTML = locked;
    dom.ledgerList.innerHTML = locked;
    return;
  }

  const pending = state.listings
    .filter((listing) => listing.status === "pending")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  dom.pendingListings.innerHTML = pending.length
    ? pending
        .map((listing) =>
          queueItem(listing, {
            actions: [
              { name: "approve", label: "Approve", kind: "approve" },
              { name: "reject", label: "Reject", kind: "reject" },
            ],
          }),
        )
        .join("")
    : `
      <div class="empty-state">
        <h3>Queue clear</h3>
        <p>New seller uploads appear here.</p>
      </div>
    `;

  dom.orderList.innerHTML = state.orders.length
    ? state.orders
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .map(orderCard)
        .join("")
    : `
      <div class="empty-state">
        <h3>No requests yet</h3>
        <p>Buyer checkout requests appear here.</p>
      </div>
    `;

  renderAccountTable();
  renderLedger();
}

function orderCard(order) {
  const listing = listingById(order.listingId);
  const canMarkPaid = order.paymentStatus !== "Paid" && order.status !== "Cancelled";
  const canQc = order.paymentStatus === "Paid" && !["QC passed", "Dispatched", "Delivered", "Cancelled"].includes(order.status);
  const canDispatch = order.status === "QC passed";
  const canDeliver = order.status === "Dispatched";
  const canCancel = !["Delivered", "Cancelled"].includes(order.status);

  return `
    <article class="queue-item order-card">
      <img src="${escapeHtml(safeImage(listing?.image))}" alt="${escapeHtml(listing?.title || "Requested item")}" />
      <div class="queue-copy">
        <div class="status-row">
          <span class="${statusClass(order.status)}">${escapeHtml(order.status)}</span>
          <span class="${statusClass(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span>
        </div>
        <h4>${escapeHtml(listing?.title || "Requested item")}</h4>
        <p class="queue-meta">${escapeHtml(order.buyerName)} - ${escapeHtml(order.contact)}</p>
        <p class="queue-meta">${escapeHtml(order.deliveryCity || "No city")} - ${escapeHtml(paymentLabel(order.paymentMethod))}</p>
        <p class="queue-meta">${escapeHtml(money(order.amount))} - payout ${escapeHtml(money(payoutFor(order.amount)))}</p>
        <p class="queue-meta">Ref: ${escapeHtml(order.paymentReference || "Not provided")}</p>
        <p class="queue-meta">${escapeHtml(order.note || "No note")}</p>
        <div class="order-progress" aria-hidden="true">
          <span style="width: ${orderProgress(order.status)}%"></span>
        </div>
        <div class="queue-actions">
          ${canMarkPaid ? `<button class="mini-button approve" type="button" data-mark-paid="${escapeHtml(order.id)}">Mark paid</button>` : ""}
          ${canQc ? `<button class="mini-button approve" type="button" data-qc-pass="${escapeHtml(order.id)}">QC pass</button>` : ""}
          ${canDispatch ? `<button class="mini-button" type="button" data-dispatch="${escapeHtml(order.id)}">Dispatch</button>` : ""}
          ${canDeliver ? `<button class="mini-button approve" type="button" data-mark-delivered="${escapeHtml(order.id)}">Delivered</button>` : ""}
          ${canCancel ? `<button class="mini-button reject" type="button" data-cancel-order="${escapeHtml(order.id)}">Cancel</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function orderProgress(status) {
  const map = {
    Requested: 18,
    "Payment received": 42,
    "QC passed": 64,
    Dispatched: 84,
    Delivered: 100,
    Cancelled: 100,
  };
  return map[status] || 28;
}

function renderAccountTable() {
  dom.accountTable.innerHTML = state.accounts
    .map((account) => {
      const orders = state.orders.filter((order) => order.buyerId === account.id).length;
      const listings = state.listings.filter((listing) => listing.sellerId === account.id).length;
      return `
        <article class="account-row">
          <div>
            <strong>${escapeHtml(account.name)}</strong>
            <span>${escapeHtml(account.email)}</span>
          </div>
          <span class="${statusClass(account.role)}">${escapeHtml(account.role)}</span>
          <span>${escapeHtml(account.city)}</span>
          <span>${listings} listings / ${orders} orders</span>
        </article>
      `;
    })
    .join("");
}

function renderLedger() {
  dom.ledgerList.innerHTML = state.auditLog.length
    ? state.auditLog
        .slice(0, 14)
        .map((event) => {
          const actor = accountById(event.actorId);
          return `
            <article class="ledger-item">
              <span class="${statusClass(event.type)}">${escapeHtml(event.type)}</span>
              <strong>${escapeHtml(event.message)}</strong>
              <small>${escapeHtml(actor?.name || "System")} - ${escapeHtml(shortDate(event.createdAt))}</small>
            </article>
          `;
        })
        .join("")
    : `
      <div class="empty-state">
        <h3>No ledger events</h3>
        <p>Admin actions appear here.</p>
      </div>
    `;
}

function renderAll() {
  renderCounts();
  renderMarketPulse();
  renderSessionSummary();
  renderPaymentSummary();
  renderAccount();
  renderBrowse();
  renderRequestPanel();
  renderSellerQueue();
  renderAdmin();
}

dom.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.viewTarget));
});

dom.authModeButtons.forEach((button) => {
  button.addEventListener("click", () => switchAuthMode(button.dataset.authMode));
});

dom.categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filters.category = button.dataset.category || "all";
    dom.categoryButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderBrowse();
  });
});

[dom.searchInput, dom.filterMinPrice, dom.filterMaxPrice].forEach((input) => {
  input.addEventListener("input", () => {
    filters.search = dom.searchInput.value.trim().toLowerCase();
    filters.minPrice = dom.filterMinPrice.value;
    filters.maxPrice = dom.filterMaxPrice.value;
    renderBrowse();
  });
});

[dom.filterCity, dom.filterCondition, dom.filterSort, dom.filterSaved].forEach((control) => {
  control.addEventListener("change", () => {
    filters.city = dom.filterCity.value;
    filters.condition = dom.filterCondition.value;
    filters.sort = dom.filterSort.value;
    filters.savedOnly = dom.filterSaved.checked;
    renderBrowse();
  });
});

dom.signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(dom.signupForm);
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") || "");

  if (state.accounts.some((account) => account.email === email)) {
    showToast("An account already exists for this email.");
    switchAuthMode("login");
    dom.loginForm.elements.email.value = email;
    return;
  }

  const account = {
    id: makeId("acct"),
    name: String(form.get("name") || "").trim(),
    email,
    passwordHash: hashPassword(password),
    role: String(form.get("role") || "buyer"),
    phone: String(form.get("phone") || "").trim(),
    city: String(form.get("city") || "").trim() || "Pakistan",
    handle: handleFromName(form.get("name") || email),
    trustScore: 78,
    savedListingIds: [],
    createdAt: new Date().toISOString(),
  };

  state.accounts.push(account);
  state.currentUserId = account.id;
  addEvent("account", `${account.name} created a ${account.role} account.`, account.id);
  dom.signupForm.reset();
  saveState();
  renderAll();
  showToast(`${account.name} is active.`);
});

dom.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(dom.loginForm);
  const email = normalizeEmail(form.get("email"));
  const account = state.accounts.find((item) => item.email === email);

  if (!passwordMatches(account, form.get("password"))) {
    showToast("Email or password did not match.");
    return;
  }

  state.currentUserId = account.id;
  dom.loginForm.reset();
  saveState();
  renderAll();
  showToast(`Welcome back, ${account.name}.`);
});

dom.imageFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  uploadedImageData = "";

  if (!file) {
    dom.imagePreview.innerHTML = "<span>No image selected</span>";
    renderListingAssistant();
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    uploadedImageData = reader.result;
    dom.imagePreview.innerHTML = `<img src="${escapeHtml(uploadedImageData)}" alt="Selected listing preview" />`;
    renderListingAssistant();
  });
  reader.readAsDataURL(file);
});

dom.listingForm.addEventListener("input", renderListingAssistant);
dom.listingForm.addEventListener("change", renderListingAssistant);

dom.listingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const account = activeAccount();

  if (!canSell(account)) {
    showToast("Log in with a seller account first.");
    switchAuthMode(account ? "signup" : "login");
    return;
  }

  const form = new FormData(dom.listingForm);
  const imageUrl = String(form.get("imageUrl") || "").trim();
  const listing = {
    id: makeId("lst"),
    title: String(form.get("title") || "").trim(),
    brand: String(form.get("brand") || "").trim() || "Unbranded",
    price: Number(form.get("price")),
    retailPrice: Number(form.get("retailPrice") || form.get("price")),
    category: form.get("category"),
    size: String(form.get("size") || "").trim() || "One size",
    condition: form.get("condition"),
    location: String(form.get("location") || "").trim() || account.city || "Pakistan",
    color: String(form.get("color") || "").trim(),
    fabric: String(form.get("fabric") || "").trim(),
    measurements: String(form.get("measurements") || "").trim(),
    flaws: String(form.get("flaws") || "").trim() || "None listed",
    sellerId: account.id,
    sellerName: account.name,
    description: String(form.get("description") || "").trim(),
    image: uploadedImageData || imageUrl || FALLBACK_IMAGE,
    status: "pending",
    qualityChecks: {
      frontPhoto: form.get("hasFrontPhoto") === "on",
      backPhoto: form.get("hasBackPhoto") === "on",
      labelPhoto: form.get("hasLabelPhoto") === "on",
      measurements: form.get("hasMeasurements") === "on" || Boolean(String(form.get("measurements") || "").trim()),
    },
    views: 0,
    savedBy: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  listing.qualityScore = listingQualityScore(listing);

  state.listings.unshift(listing);
  uploadedImageData = "";
  addEvent("listing", `${listing.title} submitted for admin review.`, listing.id);
  dom.listingForm.reset();
  dom.imagePreview.innerHTML = "<span>No image selected</span>";
  saveState();
  renderAll();
  switchView("admin");
  showToast("Listing submitted for approval.");
});

dom.orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const listing = listingById(state.selectedListingId);
  const account = activeAccount();

  if (!account) {
    showToast("Log in or create an account first.");
    switchAuthMode("login");
    return;
  }

  if (!listing) {
    showToast("Select an approved item first.");
    return;
  }

  const availability = listingAvailability(listing.id);
  if (availability.locked) {
    showToast(`${listing.title} is ${availability.label.toLowerCase()}.`);
    return;
  }

  const duplicate = state.orders.some(
    (order) => order.buyerId === account.id && order.listingId === listing.id && order.status !== "Cancelled",
  );
  if (duplicate) {
    showToast("You already requested this piece.");
    return;
  }

  const paymentMethod = dom.orderPaymentMethod.value;
  const paymentOption = paymentOptionById(paymentMethod);

  if (paymentOption.disabled) {
    showToast(`${paymentOption.label} is disabled for this prototype.`);
    return;
  }

  const order = {
    id: makeId("ord"),
    listingId: listing.id,
    buyerId: account.id,
    buyerName: dom.orderName.value.trim() || account.name,
    contact: dom.orderContact.value.trim() || account.phone || account.email,
    deliveryCity: dom.orderDeliveryCity.value.trim() || account.city || "",
    note: dom.orderNote.value.trim(),
    amount: listing.price,
    paymentMethod,
    paymentStatus: paymentMethod === "stripe-checkout" ? "Awaiting Stripe" : "Awaiting payment",
    paymentReference: dom.orderPaymentReference.value.trim(),
    status: "Requested",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.orders.push(order);
  state.selectedListingId = "";
  addEvent("order", `${account.name} requested checkout for ${listing.title}.`, order.id);
  dom.orderForm.reset();
  saveState();
  renderAll();
  switchView("pulse");
  showToast("Checkout request sent to admin.");
});

document.addEventListener("click", (event) => {
  const requestButton = event.target.closest("[data-request-id]");
  const saveButton = event.target.closest("[data-toggle-save]");
  const approveButton = event.target.closest("[data-approve]");
  const rejectButton = event.target.closest("[data-reject]");
  const logoutButton = event.target.closest("[data-logout]");
  const markPaidButton = event.target.closest("[data-mark-paid]");
  const qcPassButton = event.target.closest("[data-qc-pass]");
  const dispatchButton = event.target.closest("[data-dispatch]");
  const markDeliveredButton = event.target.closest("[data-mark-delivered]");
  const cancelOrderButton = event.target.closest("[data-cancel-order]");
  const viewShortcut = event.target.closest("[data-view-shortcut]");
  const savedFilterButton = event.target.closest("[data-set-saved-filter]");

  if (requestButton) {
    const listing = listingById(requestButton.dataset.requestId);
    const availability = listingAvailability(listing?.id);
    if (availability.locked) {
      showToast(`${listing.title} is ${availability.label.toLowerCase()}.`);
      return;
    }
    state.selectedListingId = requestButton.dataset.requestId;
    saveState();
    renderRequestPanel();
    document.querySelector(".request-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (saveButton) {
    const account = activeAccount();
    if (!account) {
      showToast("Log in to save pieces.");
      switchAuthMode("login");
      return;
    }
    const listingId = saveButton.dataset.toggleSave;
    account.savedListingIds = account.savedListingIds || [];
    if (account.savedListingIds.includes(listingId)) {
      account.savedListingIds = account.savedListingIds.filter((id) => id !== listingId);
      showToast("Removed from saved.");
    } else {
      account.savedListingIds.push(listingId);
      showToast("Saved to closet.");
    }
    saveState();
    renderAll();
  }

  if (approveButton) {
    const listing = listingById(approveButton.dataset.approve);
    if (listing && canAdmin()) {
      listing.status = "approved";
      listing.updatedAt = new Date().toISOString();
      addEvent("listing", `${listing.title} approved for the public drop.`, listing.id);
      saveState();
      renderAll();
      showToast("Listing approved.");
    }
  }

  if (rejectButton) {
    const listing = listingById(rejectButton.dataset.reject);
    if (listing && canAdmin()) {
      listing.status = "rejected";
      listing.updatedAt = new Date().toISOString();
      addEvent("listing", `${listing.title} rejected from review.`, listing.id);
      saveState();
      renderAll();
      showToast("Listing rejected.");
    }
  }

  if (logoutButton) {
    state.currentUserId = "";
    state.selectedListingId = "";
    saveState();
    renderAll();
    switchAuthMode("login");
    showToast("Logged out.");
  }

  if (markPaidButton) {
    updateOrder(markPaidButton.dataset.markPaid, (order) => {
      order.paymentStatus = "Paid";
      order.status = "Payment received";
      return "Payment marked as paid.";
    });
  }

  if (qcPassButton) {
    updateOrder(qcPassButton.dataset.qcPass, (order) => {
      order.status = "QC passed";
      return "QC passed.";
    });
  }

  if (dispatchButton) {
    updateOrder(dispatchButton.dataset.dispatch, (order) => {
      order.status = "Dispatched";
      return "Order dispatched.";
    });
  }

  if (markDeliveredButton) {
    updateOrder(markDeliveredButton.dataset.markDelivered, (order) => {
      order.status = "Delivered";
      return "Order marked delivered.";
    });
  }

  if (cancelOrderButton) {
    updateOrder(cancelOrderButton.dataset.cancelOrder, (order) => {
      order.status = "Cancelled";
      if (order.paymentStatus !== "Paid") order.paymentStatus = "Cancelled";
      return "Order cancelled.";
    });
  }

  if (viewShortcut) {
    switchView(viewShortcut.dataset.viewShortcut);
  }

  if (savedFilterButton) {
    filters.savedOnly = true;
    dom.filterSaved.checked = true;
    switchView("browse");
    renderBrowse();
  }
});

function updateOrder(orderId, updater) {
  const order = orderById(orderId);
  if (!order || !canAdmin()) return;
  const message = updater(order);
  order.updatedAt = new Date().toISOString();
  const listing = listingById(order.listingId);
  addEvent("order", `${message} ${listing?.title || "Order"}`, order.id);
  saveState();
  renderAll();
  showToast(message);
}

document.addEventListener("change", (event) => {
  if (!event.target.matches("[data-account-switch]")) return;
  state.currentUserId = event.target.value;
  state.selectedListingId = "";
  saveState();
  renderAll();
  showToast(`${activeAccount()?.name || "Account"} is active.`);
});

dom.resetDemo.addEventListener("click", () => {
  state = structuredClone(seedState);
  filters = {
    category: "all",
    search: "",
    city: "all",
    condition: "all",
    minPrice: "",
    maxPrice: "",
    sort: "newest",
    savedOnly: false,
  };
  uploadedImageData = "";
  dom.searchInput.value = "";
  dom.filterMinPrice.value = "";
  dom.filterMaxPrice.value = "";
  dom.filterSort.value = "newest";
  dom.filterSaved.checked = false;
  dom.categoryButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === "all");
  });
  dom.orderForm.reset();
  dom.listingForm.reset();
  dom.signupForm.reset();
  dom.loginForm.reset();
  dom.imagePreview.innerHTML = "<span>No image selected</span>";
  saveState();
  renderAll();
  switchAuthMode("signup");
  switchView("pulse");
  showToast("Demo reset.");
});

renderPaymentMethodOptions();
renderAll();
