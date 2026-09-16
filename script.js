const FALLBACK_IMAGE = "./assets/bechdou-editorial-collage.png";
// Must match server/db.js COMMISSION_RATE — only used as a display fallback
// for orders created before commission was stored per-order.
const COMMISSION_RATE = 0.20;

let oauthProviders = [];
let demoMode = false;
// Set from server env (BECHDOU_SUPPORT_WHATSAPP / _EMAIL). Empty until
// configured, which hides the contact buttons instead of pointing people at
// a placeholder number.
let supportWhatsapp = "";
let supportEmail = "";
let instagramHandle = "";

// Replaced wholesale by the server's real account details on bootstrap (see
// applyBootstrap). These labels exist only so an order placed before the
// bootstrap response lands still renders a sensible method name — the real
// account numbers live in server/.env and are never hardcoded here.
let paymentOptions = [
  { id: "jazzcash", label: "JazzCash" },
  { id: "easypaisa", label: "EasyPaisa" },
  { id: "bank-transfer", label: "Bank transfer" },
];

// State is hydrated from the backend (/api/bootstrap) — no longer localStorage.
let state = {
  accounts: [],
  currentUserId: "",
  listings: [],
  orders: [],
  auditLog: [],
  selectedListingId: "",
  account: null,
  marketStatus: { reserved: [], sold: [] },
  newsletterSubscribers: 0,
};

function applyBootstrap(data) {
  state = {
    accounts: data.accounts || [],
    currentUserId: data.account?.id || "",
    listings: data.listings || [],
    orders: data.orders || [],
    auditLog: data.events || [],
    selectedListingId: state.selectedListingId || "",
    account: data.account || null,
    marketStatus: data.marketStatus || { reserved: [], sold: [] },
    newsletterSubscribers: data.newsletterSubscribers || 0,
  };
  if (Array.isArray(data.paymentOptions) && data.paymentOptions.length) {
    paymentOptions = data.paymentOptions;
  }
  if (Array.isArray(data.oauthProviders)) {
    oauthProviders = data.oauthProviders;
  }
  demoMode = Boolean(data.demoMode);
  supportWhatsapp = String(data.supportWhatsapp || "");
  supportEmail = String(data.supportEmail || "");
  instagramHandle = String(data.instagramHandle || "").replace(/^@/, "");
}

async function refresh() {
  applyBootstrap(await API.bootstrap());
  renderAll();
}

async function boot() {
  try {
    applyBootstrap(await API.bootstrap());
  } catch (error) {
    showToast(error.message || "Could not reach the Bechdou server.");
  }
  renderAll();
  // Honour a deep link (#product/…, #closet/…, #verify-email?token=…).
  if (window.location.hash && window.location.hash !== "#home") {
    handleRoute();
  } else {
    switchView("home");
  }
}

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
  signedOutActions: document.getElementById("signed-out-actions"),
  accountMenu: document.getElementById("account-menu"),
  accountTrigger: document.getElementById("account-trigger"),
  accountDropdown: document.getElementById("account-dropdown"),
  accountAvatar: document.getElementById("account-avatar"),
  accountTriggerName: document.getElementById("account-trigger-name"),
  logoutButton: document.getElementById("logout-button"),
  loginView: document.getElementById("login-view"),
  signupView: document.getElementById("signup-view"),
  forgotView: document.getElementById("forgot-view"),
  resetView: document.getElementById("reset-view"),
  verifyView: document.getElementById("verify-view"),
  profileView: document.getElementById("profile-view"),
  checkoutView: document.getElementById("checkout-view"),
  confirmationView: document.getElementById("confirmation-view"),
  ordersView: document.getElementById("orders-view"),
  savedView: document.getElementById("saved-view"),
  adminView: document.getElementById("admin-view"),
  searchInput: document.getElementById("search-input"),
  filterCity: document.getElementById("filter-city"),
  filterCondition: document.getElementById("filter-condition"),
  filterMinPrice: document.getElementById("filter-min-price"),
  filterMaxPrice: document.getElementById("filter-max-price"),
  filterSort: document.getElementById("filter-sort"),
  filterSaved: document.getElementById("filter-saved"),
  resultsBar: document.getElementById("results-bar"),
  listingGrid: document.getElementById("listing-grid"),
  listingForm: document.getElementById("listing-form"),
  imageFile: document.getElementById("listing-image-file"),
  imagePreview: document.getElementById("image-preview"),
  sellerMetrics: document.getElementById("seller-metrics"),
  listingAssistant: document.getElementById("listing-assistant"),
  sellerListings: document.getElementById("seller-listings"),
  sellerRoleNote: document.getElementById("seller-role-note"),
  toast: document.getElementById("toast"),
  // Consumer storefront
  heroStatItems: document.getElementById("hero-stat-items"),
  heroStatClosets: document.getElementById("hero-stat-closets"),
  heroStatCities: document.getElementById("hero-stat-cities"),
  heroInstall: document.getElementById("hero-install"),
  homeTrending: document.getElementById("home-trending"),
  homeCategories: document.getElementById("home-categories"),
  installBanner: document.getElementById("install-banner"),
  installAccept: document.getElementById("install-accept"),
  installDismiss: document.getElementById("install-dismiss"),
  quickview: document.getElementById("quickview"),
  qvBody: document.getElementById("qv-body"),
};

const icons = {
  heart: (filled) =>
    `<svg viewBox="0 0 24 24" width="15" height="15" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9.3-8.4A5 5 0 0 1 12 6a5 5 0 0 1 9.3 5.6C19 15.6 12 20 12 20Z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  share: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  verified: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.8-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.4.4-.2.7s.7 1.2 1.5 1.9c1 .9 1.8 1.1 2.1 1.3.2.1.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.2.1.7-.1 1.2Z"/></svg>`,
};

function initials(name) {
  const words = String(name || "").trim().split(/\s+/);
  return ((words[0]?.[0] || "") + (words[1]?.[0] || "")).toUpperCase() || "B";
}

function sellerApprovedListings(sellerId) {
  return state.listings.filter(
    (listing) => listing.sellerId === sellerId && listing.status === "approved",
  );
}

// "Verified closet" means the seller confirmed their email address. It used
// to mean `trustScore >= 88`, a seeded constant no real seller could ever
// earn — so every genuine signup was permanently unverified while demo
// accounts wore the badge.
function isVerifiedSeller(account) {
  return account?.emailVerified === true;
}

// Real saves only. This used to add `views / 9` on top, which showed buyers
// a like count that nobody had actually given.
function loveCount(listing) {
  return listing.savedBy?.length || 0;
}

// How many pieces are actually live in this closet. Replaces a "followers"
// figure that was computed as `trustScore * 4 + items * 9` — Bechdou has no
// following feature, so that number was invented.
function closetSize(account) {
  return sellerApprovedListings(account.id).length;
}

// Pieces this closet has actually sold, and the year it opened — both read
// straight off real records rather than being derived from a trust score.
function soldCount(account) {
  return state.listings.filter(
    (listing) => listing.sellerId === account.id && listing.sold,
  ).length;
}

function memberSince(account) {
  const date = new Date(account.createdAt);
  return Number.isNaN(date.getTime()) ? "N/A" : String(date.getFullYear());
}

// Questions about a piece go to Bechdou, not to the seller directly.
// A public seller profile deliberately carries no phone number, so the old
// version of this fell back to a placeholder ("+92 300 0000000") on every
// listing — a number nobody answers. Routing through support also keeps the
// sale on-platform, which is what the seller's payout depends on.
// Returns "" when no support number is configured, so the caller can hide
// the button instead of rendering a dead link.
function supportChatLink(listing) {
  if (!supportWhatsapp) return "";
  const text = encodeURIComponent(
    `Hi Bechdou, I have a question about "${listing.title}" (${money(listing.price)}), listing ${listing.id}.`,
  );
  return `https://wa.me/${supportWhatsapp}?text=${text}`;
}

// Renders the WhatsApp button only when there is a real number behind it.
function supportChatButton(listing, label = "WhatsApp") {
  const href = supportChatLink(listing);
  if (!href) return "";
  return `<a class="button wa-btn" href="${escapeHtml(href)}" target="_blank" rel="noopener">${icons.whatsapp} ${escapeHtml(label)}</a>`;
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Whitelist of image sources we will render. "/uploads/" is where the server
// writes seller-uploaded photos (see persistImage in server/index.js) — leaving
// it out silently replaced every uploaded photo with the fallback collage.
// Note the single-slash prefixes are exact, so a protocol-relative
// "//evil.example" URL still falls through to the fallback.
function safeImage(value) {
  const src = String(value || "");
  if (
    src.startsWith("./assets/") ||
    src.startsWith("/uploads/") ||
    src.startsWith("data:image/") ||
    /^https?:\/\//.test(src)
  ) {
    return src;
  }
  return FALLBACK_IMAGE;
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
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

// Fallback math for orders that predate storing commission/payout per order.
// Prefer order.payoutAmount / order.commissionAmount wherever an order object
// is available — they are the actual figures charged at the time of sale.
function payoutFor(amount) {
  return Math.round(Number(amount || 0) * (1 - COMMISSION_RATE));
}

function commissionFor(amount) {
  return Math.round(Number(amount || 0) * COMMISSION_RATE);
}

function payoutForOrder(order) {
  return order.payoutAmount || payoutFor(order.amount);
}

function commissionForOrder(order) {
  return order.commissionAmount || commissionFor(order.amount);
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

function listingAvailability(listingId) {
  const order = state.orders
    .filter((item) => item.listingId === listingId && item.status !== "Cancelled")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];

  // A seller can retire a piece without any order existing for it.
  if (!order) {
    return listingById(listingId)?.sold
      ? { label: "Sold", locked: true, order: null }
      : { label: "Available", locked: false, order: null };
  }
  if (order.status === "Delivered") return { label: "Sold", locked: true, order };
  return { label: "Reserved", locked: true, order };
}

function isSaved(listingId, account = activeAccount()) {
  return Boolean(account?.savedListingIds?.includes(listingId));
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
    payout: paidOrders.reduce((sum, order) => sum + payoutForOrder(order), 0),
  };
}

function showToast(message) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
}

// Views that require a session, and the role each one needs.
const VIEW_GUARDS = {
  // Any logged-in user can open Sell — a buyer sees a one-click "become a
  // seller" prompt there instead of being turned away before they even see
  // what selling looks like.
  sell: (account) => !!account,
  admin: (account) => canAdmin(account),
  orders: (account) => !!account,
  profile: (account) => !!account,
  checkout: (account) => !!account,
  saved: (account) => !!account,
};

function switchView(view) {
  const account = activeAccount();
  const guard = VIEW_GUARDS[view];
  if (guard && !guard(account)) {
    if (!account) {
      pendingRedirect = view;
      switchView("login");
      showToast("Please log in to continue.");
      return;
    }
    showToast("You do not have access to that area.");
    return;
  }

  renderViewOnEnter(view);

  dom.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === view);
  });
  dom.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
  document.body.classList.toggle("home-active", view === "home");
  closeAccountDropdown();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let pendingRedirect = "";

// Pages are rendered lazily so they always reflect current state.
function renderViewOnEnter(view) {
  switch (view) {
    case "login": return renderLoginPage();
    case "signup": return renderSignupPage();
    case "forgot-password": return renderForgotPage();
    case "reset-password": return renderResetPage();
    case "profile": return renderProfilePage();
    case "orders": return renderOrdersPage();
    case "saved": return renderSavedPage();
    case "closets": return renderClosetsPage();
    case "about": case "payments": case "buyer-protection":
    case "shipping-delivery": case "seller-guide": case "contact":
    case "terms": case "privacy":
      return renderStaticPage(view);
    default: return undefined;
  }
}

function setFormEnabled(form, enabled) {
  Array.from(form.elements).forEach((element) => {
    element.disabled = !enabled;
  });
}

function renderCounts() {
  renderAccountMenu();
  renderNavVisibility();
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

function renderSessionSummary() {}
function renderPaymentSummary() {}

function renderAccount() {
  renderAccountMenu();
  renderNavVisibility();
}

/* ---------- Topbar account menu + role-gated nav ---------- */
function renderAccountMenu() {
  const account = activeAccount();
  const signedIn = !!account;
  if (dom.signedOutActions) dom.signedOutActions.hidden = signedIn;
  if (dom.accountMenu) dom.accountMenu.hidden = !signedIn;
  if (!signedIn) {
    closeAccountDropdown();
    return;
  }
  if (dom.accountTriggerName) dom.accountTriggerName.textContent = account.name;
  if (dom.accountAvatar) {
    if (account.avatar) {
      dom.accountAvatar.style.backgroundImage = `url("${account.avatar}")`;
      dom.accountAvatar.textContent = "";
    } else {
      dom.accountAvatar.style.backgroundImage = '';
      dom.accountAvatar.textContent = initials(account.name);
    }
  }
}

// Hide nav entries the current role cannot use.
function renderNavVisibility() {
  const account = activeAccount();
  document.querySelectorAll('[data-requires]').forEach((el) => {
    const need = el.dataset.requires;
    const ok =
      need === 'auth' ? !!account :
      need === 'seller' ? canSell(account) :
      need === 'admin' ? canAdmin(account) : true;
    el.hidden = !ok;
  });
}

function closeAccountDropdown() {
  if (!dom.accountDropdown) return;
  dom.accountDropdown.hidden = true;
  if (dom.accountTrigger) dom.accountTrigger.setAttribute('aria-expanded', 'false');
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

  const seller = accountById(listing.sellerId);
  const verified = isVerifiedSeller(seller);
  const id = escapeHtml(listing.id);

  return `
    <article class="listing-card" role="listitem">
      <div class="listing-media" data-quickview="${id}" role="button" tabindex="0" aria-label="Quick view ${escapeHtml(listing.title)}">
        <img src="${escapeHtml(safeImage(listing.image))}" alt="${escapeHtml(listing.title)}, ${escapeHtml(listing.brand)} ${escapeHtml(listing.category)} in ${escapeHtml(listing.location || "Pakistan")}" loading="lazy" decoding="async" />
        <span class="badge">${escapeHtml(listing.category)}</span>
        <button
          class="save-button ${saved ? "is-saved" : ""}"
          type="button"
          data-toggle-save="${id}"
          aria-pressed="${saved ? "true" : "false"}"
          aria-label="${saved ? "Remove from saved" : "Save piece"}"
        >
          ${icons.heart(saved)} ${saved ? "Saved" : "Save"}
        </button>
        <div class="card-quick">
          <button class="quick-act" type="button" data-quickview="${id}" aria-label="Quick view">${icons.eye}</button>
          <button class="quick-act" type="button" data-share="${id}" aria-label="Share piece">${icons.share}</button>
          <button class="quick-act" type="button" data-toggle-save="${id}" aria-label="Save piece">${icons.heart(saved)}</button>
        </div>
      </div>
      <div class="listing-body">
        <span class="listing-brandline">${escapeHtml(listing.brand)}</span>
        <div class="listing-title-row">
          <h3><a class="listing-title-link" href="#product/${id}">${escapeHtml(listing.title)}</a></h3>
          <span class="price">${escapeHtml(money(listing.price))}</span>
        </div>
        <p class="listing-meta">
          <span>${escapeHtml(listing.size || "One size")}</span>
          <span>${escapeHtml(listing.condition)}</span>
        </p>
        <div class="quality-row">
          <span class="${statusClass(availability.label)}">${escapeHtml(availability.label)}</span>
          <span>${quality}% QC</span>
          ${discount ? `<span>${discount}% below retail</span>` : ""}
        </div>
        <div class="listing-seller">
          <span class="seller-av">${escapeHtml(initials(listing.sellerName))}</span>
          <span class="listing-seller__meta">
            <strong>${escapeHtml(listing.sellerName)}${verified ? `<span class="verified-badge" title="Verified closet">${icons.verified}</span>` : ""}</strong>
            <span>${escapeHtml(seller?.city || listing.location || "Pakistan")}</span>
          </span>
          <span class="listing-likes">${icons.heart(true)} ${loveCount(listing)}</span>
        </div>
        <div class="listing-actions">
          <button class="button secondary" type="button" data-request-id="${id}" ${
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
    dom.sellerMetrics.innerHTML = account
      ? `${metricCard("Seller access", "Not yet", "One click away, it's free")}`
      : `
        ${metricCard("Listing fee", "Free", "Open a closet in one click")}
        ${metricCard("You keep", `${100 - Math.round(COMMISSION_RATE * 100)}%`, "Sent once the sale clears")}
        ${metricCard("Bechdou's cut", `${Math.round(COMMISSION_RATE * 100)}%`, "Covers QC, moderation, support")}
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
    : account
      ? `<button class="button primary sm" type="button" data-become-seller>Become a seller, it's free</button>`
      : `<span class="status pending">Seller login required</span>`;

  renderSellerMetrics();
  renderListingAssistant();

  const listings = state.listings
    .filter((listing) => account && (listing.sellerId === account.id || account.role === "admin"))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  dom.sellerListings.innerHTML = listings.length
    ? listings.map((listing) => queueItem(listing, { actions: sellerActions(listing) })).join("")
    : `
      <div class="empty-state">
        <h3>No listings yet</h3>
        <p>Submitted pieces appear here after seller login.</p>
      </div>
    `;
}

function sellerActions(listing) {
  return [
    { name: "seller-edit", label: "Edit" },
    { name: "seller-sold", label: listing.sold ? "Mark available" : "Mark sold" },
    { name: "seller-delete", label: "Delete", kind: "danger" },
  ];
}

/* Admin dashboard lives in admin.js */

// Photos for a listing. Falls back to the single legacy image for older rows.
function listingGallery(listing) {
  const images = Array.isArray(listing?.images) && listing.images.length
    ? listing.images
    : [listing?.image];
  const clean = unique(images.filter(Boolean).map(safeImage));
  return clean.length ? clean : [FALLBACK_IMAGE];
}

// Thumbnail strip shared by the quick view and the product page.
function galleryThumbs(listing, scope) {
  const gallery = listingGallery(listing);
  if (gallery.length < 2) return "";
  return `
    <div class="${scope}__thumbs gallery-thumbs" data-gallery-scope="${escapeHtml(scope)}">
      ${gallery
        .map(
          (src, i) => `
            <button type="button" class="${i === 0 ? "is-active" : ""}"
              data-gallery-thumb="${escapeHtml(src)}" data-gallery-target="${escapeHtml(scope)}"
              aria-label="View photo ${i + 1} of ${gallery.length}">
              <img src="${escapeHtml(src)}" alt="" loading="lazy" />
            </button>`,
        )
        .join("")}
    </div>
  `;
}

function discountOf(listing) {
  return listing.retailPrice > listing.price
    ? Math.round((1 - listing.price / listing.retailPrice) * 100)
    : 0;
}

function emptyMini(message) {
  return `<div class="empty-state"><h3>${escapeHtml(message)}</h3><p>Check back soon. New pieces drop daily.</p></div>`;
}

function skeletonCards(count) {
  return Array.from({ length: count })
    .map(
      () => `
      <article class="listing-card is-skeleton" aria-hidden="true">
        <div class="listing-media skeleton-box"></div>
        <div class="listing-body">
          <div class="skeleton-box sk-line" style="width:72%"></div>
          <div class="skeleton-box sk-line short"></div>
          <div class="skeleton-box sk-line" style="height:36px;border-radius:7px;margin-top:4px"></div>
        </div>
      </article>`,
    )
    .join("");
}

let homeReady = false;

function renderHome() {
  renderHeroStats();
  renderFeaturedBand();
  renderHomeCategories();
  renderFooterSocial();
  renderInstagramSection();

  if (!homeReady) {
    dom.homeTrending.innerHTML = skeletonCards(4);
    setTimeout(() => {
      homeReady = true;
      fillHomeCarousels();
    }, 700);
  } else {
    fillHomeCarousels();
  }
}

function fillHomeCarousels() {
  const approved = state.listings.filter((listing) => listing.status === "approved");
  const trending = [...approved].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);

  dom.homeTrending.innerHTML = trending.length ? trending.map(listingCard).join("") : emptyMini("No drops yet");
  dom.homeTrending.setAttribute("aria-busy", "false");
}

function renderHeroStats() {
  const approved = state.listings.filter((listing) => listing.status === "approved");
  dom.heroStatItems.textContent = approved.length;
  dom.heroStatClosets.textContent = unique(approved.map((listing) => listing.sellerId)).length;
  dom.heroStatCities.textContent = unique(approved.map((listing) => listing.location)).length;
}

// "Featured closet of the month" — the closet with the most live pieces.
// Hidden entirely until a real closet qualifies, so a brand-new site never
// shows an empty band.
function renderFeaturedBand() {
  const band = document.getElementById("featured-band");
  if (!band) return;

  const seller = state.accounts
    .filter((account) => sellerApprovedListings(account.id).length > 0)
    .sort((a, b) => closetSize(b) - closetSize(a))[0];

  if (!seller) {
    band.innerHTML = "";
    return;
  }

  const pieces = sellerApprovedListings(seller.id);
  const firstName = String(seller.name || "").trim().split(/\s+/)[0] || seller.name;

  band.innerHTML = `
    <div class="featured-band__media">
      <img src="${escapeHtml(safeImage(pieces[0]?.image))}" alt="${escapeHtml(seller.name)}'s closet" loading="lazy" decoding="async" />
    </div>
    <div>
      <p class="featured-band__eyebrow">Featured closet</p>
      <h2>${escapeHtml(firstName)}'s Edit</h2>
      <p class="script-label">Timeless pieces. Thoughtfully chosen.</p>
      <button class="button primary caps" type="button" data-open-closet="${escapeHtml(seller.id)}">
        Shop this closet →
      </button>
    </div>
    <div class="featured-seal" aria-hidden="true">
      <div>
        <span>B</span>
        <small>Curated closets<br />Real people</small>
      </div>
    </div>
  `;
}

// Curated editorial set for the homepage row — deliberately not every
// category in the system (Outerwear stays selectable everywhere else), so
// this can match a fixed, designed layout instead of growing unbounded as
// sellers add categories.
const HOME_CATEGORY_ORDER = ["Tops", "Dresses", "Denim", "Bags", "Shoes", "Accessories"];

function renderHomeCategories() {
  const approved = state.listings.filter((listing) => listing.status === "approved");
  dom.homeCategories.innerHTML = HOME_CATEGORY_ORDER
    .map((name) => {
      const inCat = approved.filter((listing) => listing.category === name);
      // Show a real piece from the category where there is one, otherwise
      // fall back to any live listing so the circle never renders bare.
      const art = inCat[0]?.image || approved[0]?.image;
      return `
        <button class="category-circle" type="button" data-category-jump="${escapeHtml(name)}">
          <span class="category-circle__img">
            <img src="${escapeHtml(safeImage(art))}" alt="" loading="lazy" decoding="async" />
          </span>
          <em>${escapeHtml(name)}</em>
        </button>`;
    })
    .join("");
}

function closetCard(seller) {
  const items = sellerApprovedListings(seller.id);
  const thumbs = items.slice(0, 3);
  return `
    <article class="closet-card">
      <div class="closet-head">
        <span class="closet-av">${escapeHtml(initials(seller.name))}</span>
        <span class="closet-id">
          <strong>${escapeHtml(seller.name)}${isVerifiedSeller(seller) ? `<span class="verified-badge" title="Verified closet">${icons.verified}</span>` : ""}</strong>
          <span>${escapeHtml(seller.handle || "@" + initials(seller.name).toLowerCase())} · ${escapeHtml(seller.city || "Pakistan")}</span>
        </span>
      </div>
      <div class="closet-stats">
        <div><strong>${items.length}</strong><span>${items.length === 1 ? "Piece" : "Pieces"}</span></div>
        <div><strong>${soldCount(seller)}</strong><span>Sold</span></div>
        <div><strong>${memberSince(seller)}</strong><span>Since</span></div>
      </div>
      <div class="closet-thumbs">
        ${thumbs.map((l) => `<img src="${escapeHtml(safeImage(l.image))}" alt="${escapeHtml(l.title)}" loading="lazy" />`).join("")}
      </div>
      <div class="closet-actions">
        <button class="button primary" type="button" data-open-closet="${escapeHtml(seller.id)}">Visit closet</button>
      </div>
    </article>`;
}

function renderClosetsPage() {
  const panel = document.querySelector('[data-view-panel="closets"]');
  if (!panel) return;
  const sellers = state.accounts
    .filter((account) => sellerApprovedListings(account.id).length > 0)
    .sort((a, b) => closetSize(b) - closetSize(a));

  panel.innerHTML = `
    <div class="page-shell">
      <header class="page-head">
        <div>
          <p class="eyebrow">Community</p>
          <h1>Seller closets</h1>
        </div>
        <span class="count-pill">${sellers.length}</span>
      </header>
      ${sellers.length
        ? `<div class="closet-row">${sellers.map(closetCard).join("")}</div>`
        : `<p class="empty-note">No closets with approved pieces yet.</p>`}
    </div>
  `;
}

// Footer social links and the "Secure Wallet Pay" trust pill's subtitle are
// both driven by server config rather than hardcoded, so neither can drift
// into naming a channel that isn't actually live (see supportWhatsapp /
// paymentOptions in applyBootstrap).
function renderFooterSocial() {
  const wa = document.getElementById("footer-whatsapp");
  if (wa) {
    if (supportWhatsapp) {
      wa.href = `https://wa.me/${supportWhatsapp}`;
      wa.hidden = false;
    } else {
      wa.hidden = true;
    }
  }

  const ig = document.getElementById("footer-instagram");
  if (ig) {
    if (instagramHandle) {
      ig.href = `https://instagram.com/${instagramHandle}`;
      ig.hidden = false;
    } else {
      ig.hidden = true;
    }
  }

  const methods = document.getElementById("trust-payment-methods");
  if (methods) {
    methods.textContent = paymentOptions.length
      ? paymentOptions.map((option) => option.label).join(" & ")
      : "Coming soon";
  }
}

// Hidden entirely until BECHDOU_INSTAGRAM_HANDLE is configured — no fake
// social feed for an account that may not exist.
function renderInstagramSection() {
  const section = document.getElementById("instagram-section");
  const link = document.getElementById("instagram-follow-link");
  if (!section || !link) return;

  if (!instagramHandle) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  link.href = `https://instagram.com/${instagramHandle}`;
  const label = document.getElementById("instagram-follow-label");
  if (label) label.textContent = `Follow @${instagramHandle}`;
}

/* =====================================================================
   PRODUCT DETAIL PAGE (#product/<id>)
   ===================================================================== */
function renderProductDetail(listingId) {
  const view = document.getElementById("product-view");
  const listing = state.listings.find((l) => l.id === listingId && l.status === "approved");

  if (!listing) {
    view.innerHTML = `
      <div class="pd-shell">
        <nav class="pd-back">
          <button class="link-button" type="button" data-back-nav>← Back</button>
        </nav>
        <div class="empty-state">
          <h3>Piece unavailable</h3>
          <p>It may have been removed or sold.</p>
          <button class="button primary" type="button" data-view-target="browse">Browse all</button>
        </div>
      </div>`;
    return;
  }

  const seller = accountById(listing.sellerId);
  const verified = isVerifiedSeller(seller);
  const availability = listingAvailability(listing.id);
  const saved = isSaved(listing.id);
  const discount = discountOf(listing);
  const quality = listingQualityScore(listing);
  const related = state.listings
    .filter((l) => l.status === "approved" && l.id !== listing.id &&
      (l.category === listing.category || l.sellerId === listing.sellerId))
    .slice(0, 4);

  const facts = [
    ["Brand", listing.brand],
    ["Size", listing.size || "One size"],
    ["Condition", listing.condition],
    ["Colour", listing.color],
    ["Fabric", listing.fabric],
    ["Measurements", listing.measurements],
    ["Flaws", listing.flaws],
    ["City", seller?.city || listing.location],
  ].filter(([, v]) => v && v !== "Not specified");

  view.innerHTML = `
    <div class="pd-shell">
      <nav class="pd-back" aria-label="Navigation">
        <button class="link-button" type="button" data-back-nav>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <span class="pd-crumb">${escapeHtml(listing.category)} / ${escapeHtml(listing.brand)}</span>
      </nav>

      <div class="pd-grid">
        <div class="pd-gallery">
          <div class="pd-main-img">
            <img id="pd-stage-img" src="${escapeHtml(listingGallery(listing)[0])}" alt="${escapeHtml(listing.title)}" />
            ${availability.locked ? `<span class="pd-sold-badge">${escapeHtml(availability.label)}</span>` : ""}
          </div>
          ${galleryThumbs(listing, "pd")}
          ${discount ? `<div class="pd-discount-chip">${discount}% below retail</div>` : ""}
        </div>

        <div class="pd-info">
          <p class="pd-seller-line">
            <span class="seller-av sm">${escapeHtml(initials(listing.sellerName))}</span>
            <button class="link-button" type="button" data-open-closet="${escapeHtml(listing.sellerId)}">
              ${escapeHtml(listing.sellerName)}${verified ? `<span class="verified-badge" title="Verified closet">${icons.verified}</span>` : ""}
            </button>
          </p>
          <h1 class="pd-title">${escapeHtml(listing.title)}</h1>
          <div class="pd-price">
            <strong>${escapeHtml(money(listing.price))}</strong>
            ${listing.retailPrice > listing.price ? `<s class="retail">${escapeHtml(money(listing.retailPrice))}</s>` : ""}
            ${discount ? `<span class="qv__off">${discount}% off retail</span>` : ""}
          </div>
          <span class="${statusClass(availability.label)} pd-avail">${escapeHtml(availability.label)}</span>

          <div class="pd-facts">
            ${facts.map(([k, v]) => `<div class="pd-fact"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join("")}
          </div>

          <p class="pd-description">${escapeHtml(listing.description)}</p>

          <div class="pd-quality">
            <span class="${statusClass(quality >= 82 ? "Drop-ready" : "Needs polish")}">${quality}% QC score</span>
            <div class="meter"><span style="width:${quality}%"></span></div>
          </div>

          <div class="pd-trust">
            <div><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg> JazzCash, EasyPaisa, or bank transfer</div>
            <div><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg> QC checked before dispatch</div>
            <div><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/></svg> TCS &amp; Leopards nationwide</div>
          </div>

          <div class="pd-cta">
            <button class="button primary lg" type="button" data-request-id="${escapeHtml(listing.id)}" ${availability.locked ? "disabled" : ""}>
              ${availability.locked ? escapeHtml(availability.label) : "Buy now"}
            </button>
            ${supportChatButton(listing, "Ask about this piece")}
          </div>
          <button class="button secondary" style="width:100%;justify-content:center;margin-top:.5rem" type="button" data-toggle-save="${escapeHtml(listing.id)}">
            ${icons.heart(saved)} ${saved ? "Saved to closet" : "Save to closet"}
          </button>
        </div>
      </div>

      ${related.length ? `
        <section class="pd-related">
          <h2>More from this closet &amp; category</h2>
          <div class="carousel" role="list">${related.map(listingCard).join("")}</div>
        </section>` : ""}
    </div>
  `;
}

/* =====================================================================
   SELLER CLOSET PAGE (#closet/<id>)
   ===================================================================== */
function renderSellerCloset(sellerId) {
  const view = document.getElementById("closet-view");
  const seller = state.accounts.find((a) => a.id === sellerId);
  const listings = seller ? sellerApprovedListings(sellerId) : [];

  if (!seller) {
    view.innerHTML = `
      <div class="pd-shell">
        <nav class="pd-back">
          <button class="link-button" type="button" data-back-nav>← Back</button>
        </nav>
        <div class="empty-state"><h3>Seller not found</h3></div>
      </div>`;
    return;
  }

  const verified = isVerifiedSeller(seller);

  view.innerHTML = `
    <div class="pd-shell">
      <nav class="pd-back" aria-label="Navigation">
        <button class="link-button" type="button" data-back-nav>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
      </nav>

      <header class="closet-detail-head">
        <span class="closet-av lg"${seller.avatar ? ` style="background-image:url('${escapeHtml(seller.avatar)}')"` : ""}>
          ${seller.avatar ? "" : escapeHtml(initials(seller.name))}
        </span>
        <div class="closet-detail-meta">
          <h1>${escapeHtml(seller.name)}${verified ? `<span class="verified-badge" title="Verified closet">${icons.verified} Verified</span>` : ""}</h1>
          <p>${escapeHtml(seller.handle || "@" + initials(seller.name).toLowerCase())} · ${escapeHtml(seller.city || "Pakistan")}</p>
          ${seller.bio ? `<p class="closet-bio">${escapeHtml(seller.bio)}</p>` : ""}
          <div class="closet-detail-stats">
            <div><strong>${listings.length}</strong><span>${listings.length === 1 ? "Piece" : "Pieces"}</span></div>
            <div><strong>${soldCount(seller)}</strong><span>Sold</span></div>
            <div><strong>${memberSince(seller)}</strong><span>Since</span></div>
          </div>
        </div>
      </header>

      <div class="closet-detail-grid" role="list" aria-label="${escapeHtml(seller.name)}'s closet">
        ${listings.length ? listings.map(listingCard).join("") : emptyMini("No approved pieces yet")}
      </div>
    </div>
  `;
}

/* =====================================================================
   HASH-BASED ROUTING  (#product/<id>  |  #closet/<id>  |  #checkout-success)
   ===================================================================== */
function handleRoute() {
  const hash = window.location.hash;
  const productMatch = hash.match(/^#product\/([^/]+)$/);
  const closetMatch = hash.match(/^#closet\/([^/]+)$/);

  if (productMatch) {
    switchView("product");
    renderProductDetail(decodeURIComponent(productMatch[1]));
    return;
  }
  if (closetMatch) {
    switchView("closet");
    renderSellerCloset(decodeURIComponent(closetMatch[1]));
    return;
  }
  const checkoutMatch = hash.match(/^#checkout\/([^/?]+)/);
  if (checkoutMatch) {
    openCheckout(decodeURIComponent(checkoutMatch[1]));
    return;
  }

  const route = hash.replace(/^#/, "").split("?")[0];

  // A verification link carries its token in the hash query.
  if (route === "verify-email" && hash.includes("token=")) {
    switchView("verify-email");
    renderVerifyResultPage();
    return;
  }

  // The OAuth callback never has its own page — it just carries a token (or
  // an error) once, then hands off straight into the normal app.
  if (route === "oauth-callback") {
    handleOAuthCallback();
    return;
  }

  if (AUTH_ROUTES.has(route)) {
    switchView(route);
    return;
  }
}

async function handleOAuthCallback() {
  const token = hashParam("token");
  const error = hashParam("error");
  window.history.replaceState(null, "", window.location.pathname);

  if (error) {
    showToast(error);
    switchView("login");
    return;
  }
  if (!token) {
    switchView("login");
    return;
  }

  API.setToken(token);
  await refresh();
  switchView("home");
  showToast(`Welcome, ${activeAccount()?.name || "there"}.`);
}

// Routes that render a full page rather than a storefront panel.
const AUTH_ROUTES = new Set([
  "login", "signup", "forgot-password", "reset-password", "verify-email",
  "profile", "orders", "saved", "checkout", "confirmation", "closets",
  "about", "payments", "buyer-protection", "shipping-delivery",
  "seller-guide", "contact", "terms", "privacy",
]);

window.addEventListener("hashchange", handleRoute);

/* ---------- QUICK VIEW (product detail) ---------- */
let lastFocusedEl = null;

function openQuickView(listingId) {
  const listing = listingById(listingId);
  if (!listing) return;
  const seller = accountById(listing.sellerId);
  const verified = isVerifiedSeller(seller);
  const availability = listingAvailability(listing.id);
  const saved = isSaved(listing.id);
  const discount = discountOf(listing);
  const gallery = listingGallery(listing);
  const facts = [
    ["Brand", listing.brand],
    ["Size", listing.size || "One size"],
    ["Condition", listing.condition],
    ["Colour", listing.color],
    ["Fabric", listing.fabric],
    ["City", seller?.city || listing.location],
  ].filter(([, value]) => value);

  dom.qvBody.innerHTML = `
    <div class="qv__gallery">
      <div class="qv__stage"><img id="qv-stage-img" src="${escapeHtml(gallery[0])}" alt="${escapeHtml(listing.title)}" /></div>
      ${galleryThumbs(listing, "qv")}
    </div>
    <div class="qv__info">
      <p class="qv__crumbs">Home / ${escapeHtml(listing.category)} / ${escapeHtml(listing.brand)}</p>
      <h2 class="qv__title" id="qv-title">${escapeHtml(listing.title)}</h2>
      <div class="qv__price">
        <strong>${escapeHtml(money(listing.price))}</strong>
        ${listing.retailPrice > listing.price ? `<s>${escapeHtml(money(listing.retailPrice))}</s>` : ""}
        ${discount ? `<span class="qv__off">${discount}% off retail</span>` : ""}
      </div>
      <div class="qv__facts">
        ${facts.map(([k, v]) => `<span><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`).join("")}
      </div>
      <p class="qv__desc">${escapeHtml(listing.description)}</p>
      <div class="qv__seller">
        <span class="seller-av">${escapeHtml(initials(listing.sellerName))}</span>
        <span class="listing-seller__meta" style="flex:1">
          <strong>${escapeHtml(listing.sellerName)}${verified ? `<span class="verified-badge">${icons.verified} Verified</span>` : ""}</strong>
          <span>${escapeHtml(seller?.city || listing.location || "Pakistan")}${seller ? ` · ${closetSize(seller)} ${closetSize(seller) === 1 ? "piece" : "pieces"}` : ""}</span>
        </span>
        <button class="button secondary sm" type="button" data-open-closet="${escapeHtml(listing.sellerId)}">Visit closet</button>
      </div>
      <div class="qv__trust">
        <div><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg> JazzCash, EasyPaisa, or bank transfer</div>
        <div><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg> Buyer Protection · QC checked before dispatch</div>
        <div><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/></svg> TCS &amp; Leopards delivery nationwide</div>
      </div>
      <div class="qv__cta">
        <button class="button primary" type="button" data-qv-buy="${escapeHtml(listing.id)}" ${availability.locked ? "disabled" : ""}>${availability.locked ? escapeHtml(availability.label) : "Buy now"}</button>
        ${supportChatButton(listing)}
      </div>
      <button class="button secondary" style="width:100%;justify-content:center" type="button" data-toggle-save="${escapeHtml(listing.id)}">${icons.heart(saved)} ${saved ? "Saved to closet" : "Save to closet"}</button>
    </div>`;

  lastFocusedEl = document.activeElement;
  dom.quickview.hidden = false;
  document.body.style.overflow = "hidden";
  dom.quickview.querySelector(".modal__close")?.focus();
}

function closeQuickView() {
  if (dom.quickview.hidden) return;
  dom.quickview.hidden = true;
  document.body.style.overflow = "";
  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
}

function renderAll() {
  renderHome();
  renderCounts();
  renderSessionSummary();
  renderPaymentSummary();
  renderAccount();
  renderBrowse();
  renderSellerQueue();
  renderAdmin();
}

// Delegated so buttons rendered later (auth pages, admin, status panels) work too.
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view-target]");
  if (!target) return;
  event.preventDefault();
  switchView(target.dataset.viewTarget);
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

/* ---------- Image compression (client-side Canvas resize before upload) ---------- */
function compressImage(dataUrl, maxPx = 1000, quality = 0.78) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round(height * (maxPx / width));
          width = maxPx;
        } else {
          width = Math.round(width * (maxPx / height));
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const MAX_LISTING_IMAGES = 6;
let uploadedImages = [];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

dom.imageFile.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []).slice(0, MAX_LISTING_IMAGES);
  uploadedImages = [];
  uploadedImageData = "";

  if (!files.length) {
    dom.imagePreview.innerHTML = "<span>No image selected</span>";
    renderListingAssistant();
    return;
  }

  dom.imagePreview.innerHTML = "<span>Processing photos…</span>";
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    uploadedImages.push(await compressImage(dataUrl));
  }
  uploadedImageData = uploadedImages[0] || "";

  dom.imagePreview.innerHTML = uploadedImages
    .map((src, i) => `<img src="${escapeHtml(src)}" alt="Listing photo ${i + 1}" />`)
    .join("");
  renderListingAssistant();
});

dom.listingForm.addEventListener("input", renderListingAssistant);
dom.listingForm.addEventListener("change", renderListingAssistant);

dom.listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const account = activeAccount();

  if (!canSell(account)) {
    showToast(account ? "Switch to a seller account to list." : "Log in as a seller first.");
    if (!account) switchView("login");
    return;
  }

  const form = new FormData(dom.listingForm);
  const imageUrl = String(form.get("imageUrl") || "").trim();
  const payload = {
    title: form.get("title"),
    brand: form.get("brand"),
    price: Number(form.get("price")),
    retailPrice: Number(form.get("retailPrice") || form.get("price")),
    category: form.get("category"),
    size: form.get("size"),
    condition: form.get("condition"),
    location: form.get("location"),
    color: form.get("color"),
    fabric: form.get("fabric"),
    measurements: form.get("measurements"),
    flaws: form.get("flaws"),
    description: form.get("description"),
    image: uploadedImageData || imageUrl || undefined,
    images: uploadedImages.length ? uploadedImages : imageUrl ? [imageUrl] : undefined,
    qualityChecks: {
      frontPhoto: form.get("hasFrontPhoto") === "on",
      backPhoto: form.get("hasBackPhoto") === "on",
      labelPhoto: form.get("hasLabelPhoto") === "on",
      measurements: form.get("hasMeasurements") === "on" || Boolean(String(form.get("measurements") || "").trim()),
    },
  };

  try {
    await API.createListing(payload);
    uploadedImageData = "";
    uploadedImages = [];
    dom.listingForm.reset();
    dom.imagePreview.innerHTML = "<span>No image selected</span>";
    await refresh();
    switchView("sell");
    showToast("Listing submitted for approval.");
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener("click", async (event) => {
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
    closeQuickView();
    openCheckout(requestButton.dataset.requestId);
    return;
  }

  if (saveButton) {
    if (!activeAccount()) {
      showToast("Log in to save pieces.");
      switchView("login");
      return;
    }
    try {
      const { saved } = await API.toggleSave(saveButton.dataset.toggleSave);
      await refresh();
      // Un-saving while viewing the Saved page should drop the card immediately.
      if (dom.savedView.classList.contains("is-active")) renderSavedPage();
      showToast(saved ? "Saved to closet." : "Removed from saved.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (approveButton) {
    try {
      await API.approveListing(approveButton.dataset.approve);
      await refresh();
      showToast("Listing approved.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (rejectButton) {
    try {
      await API.rejectListing(rejectButton.dataset.reject);
      await refresh();
      showToast("Listing rejected.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (logoutButton) {
    API.logout();
    state.selectedListingId = "";
    await refresh();
    switchView("home");
    showToast("Logged out.");
    return;
  }

  if (markPaidButton) return runOrderAction(markPaidButton.dataset.markPaid, "paid", "Payment marked as paid.");
  if (qcPassButton) return runOrderAction(qcPassButton.dataset.qcPass, "qc", "QC passed.");
  if (dispatchButton) return runOrderAction(dispatchButton.dataset.dispatch, "dispatch", "Order dispatched.");
  if (markDeliveredButton) return runOrderAction(markDeliveredButton.dataset.markDelivered, "delivered", "Order delivered.");
  if (cancelOrderButton) return runOrderAction(cancelOrderButton.dataset.cancelOrder, "cancel", "Order cancelled.");

  if (viewShortcut) {
    switchView(viewShortcut.dataset.viewShortcut);
    return;
  }

  if (savedFilterButton) {
    filters.savedOnly = true;
    dom.filterSaved.checked = true;
    switchView("browse");
    renderBrowse();
  }
});

async function runOrderAction(orderId, action, message) {
  try {
    await API.orderAction(orderId, action);
    await refresh();
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

document.addEventListener("change", (event) => {
  if (!event.target.matches("[data-account-switch]")) return;
  // Real authentication is in place — admins cannot impersonate other users.
  event.target.value = state.currentUserId;
  showToast("Switch accounts by logging in with their email and password.");
});

/* =====================================================================
   STOREFRONT INTERACTIONS — quick view, share, filters, PWA, reveals
   ===================================================================== */

function applyBrowse(next = {}) {
  filters = {
    category: "all",
    search: "",
    city: "all",
    condition: "all",
    minPrice: "",
    maxPrice: "",
    sort: filters.sort || "newest",
    savedOnly: false,
    ...next,
  };
  dom.searchInput.value = next.search || "";
  dom.filterMinPrice.value = next.minPrice || "";
  dom.filterMaxPrice.value = next.maxPrice || "";
  dom.filterCity.value = "all";
  dom.filterCondition.value = "all";
  dom.filterSaved.checked = false;
  dom.categoryButtons.forEach((button) => {
    button.classList.toggle("is-active", (button.dataset.category || "all") === (next.category || "all"));
  });
  closeQuickView();
  switchView("browse");
  renderBrowse();
}

function shareListing(listingId) {
  const listing = listingById(listingId);
  if (!listing) return;
  const url = location.href.split("#")[0];
  const text = `${listing.title}, ${money(listing.price)} on Bechdou`;
  if (navigator.share) {
    navigator.share({ title: "Bechdou", text, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
    showToast("Sharing to WhatsApp.");
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-modal-close]")) {
    closeQuickView();
    return;
  }

  const shareEl = event.target.closest("[data-share]");
  if (shareEl) {
    shareListing(shareEl.dataset.share);
    return;
  }

  const qvBuy = event.target.closest("[data-qv-buy]");
  if (qvBuy) {
    const listing = listingById(qvBuy.dataset.qvBuy);
    if (!listing || listingAvailability(listing.id).locked) return;
    closeQuickView();
    openCheckout(listing.id);
    return;
  }

  // Works for both the quick view (#qv-stage-img) and product page (#pd-stage-img).
  const thumb = event.target.closest("[data-gallery-thumb]");
  if (thumb) {
    const scope = thumb.dataset.galleryTarget;
    const stage = document.getElementById(`${scope}-stage-img`);
    if (stage) stage.src = thumb.dataset.galleryThumb;
    thumb
      .closest("[data-gallery-scope]")
      ?.querySelectorAll("[data-gallery-thumb]")
      .forEach((button) => button.classList.toggle("is-active", button === thumb));
    return;
  }

  const openClosetEl = event.target.closest("[data-open-closet]");
  if (openClosetEl) {
    closeQuickView();
    window.location.hash = `#closet/${openClosetEl.dataset.openCloset}`;
    return;
  }

  const closetEl = event.target.closest("[data-closet-seller]");
  if (closetEl) {
    applyBrowse({ search: closetEl.dataset.closetSeller });
    showToast(`Browsing ${closetEl.dataset.closetSeller}'s closet.`);
    return;
  }

  const backNavEl = event.target.closest("[data-back-nav]");
  if (backNavEl) {
    if (history.length > 1) {
      history.back();
    } else {
      switchView("browse");
    }
    return;
  }

  const categoryJump = event.target.closest("[data-category-jump]");
  if (categoryJump) {
    applyBrowse({ category: categoryJump.dataset.categoryJump });
    return;
  }

  // Section-within-home jumps (How it works, FAQ) are handled by the
  // [data-section-jump] listener in wire.js, which sequences correctly with
  // switchView's own scroll-to-top instead of racing it.

  // Open quick view last, but never when an inner action button was clicked
  const quickviewEl = event.target.closest("[data-quickview]");
  if (quickviewEl && !event.target.closest("[data-toggle-save],[data-request-id]")) {
    openQuickView(quickviewEl.dataset.quickview);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeQuickView();
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    const media = event.target.closest?.("[data-quickview]");
    if (media && media.getAttribute("role") === "button") {
      event.preventDefault();
      openQuickView(media.dataset.quickview);
    }
  }
});

/* ---------- Scroll reveal ---------- */
function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );
  els.forEach((el) => observer.observe(el));
}

/* ---------- PWA install ---------- */
let deferredPrompt = null;

function showInstallBanner() {
  if (localStorage.getItem("bechdou-install-dismissed") === "1") return;
  if (window.matchMedia("(display-mode: standalone)").matches) return;
  dom.installBanner.hidden = false;
  requestAnimationFrame(() => dom.installBanner.classList.add("is-visible"));
}

function hideInstallBanner() {
  dom.installBanner.classList.remove("is-visible");
  setTimeout(() => {
    dom.installBanner.hidden = true;
  }, 320);
}

async function triggerInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    hideInstallBanner();
    showToast(choice.outcome === "accepted" ? "Installing Bechdou…" : "Install anytime from the menu.");
  } else {
    showToast("Open your browser menu → Add to Home Screen.");
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  dom.heroInstall.hidden = false;
  showInstallBanner();
});

window.addEventListener("appinstalled", () => {
  hideInstallBanner();
  showToast("Bechdou added to your homescreen.");
});

dom.installAccept.addEventListener("click", triggerInstall);
dom.heroInstall.addEventListener("click", triggerInstall);
dom.installDismiss.addEventListener("click", () => {
  localStorage.setItem("bechdou-install-dismissed", "1");
  hideInstallBanner();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------- Init ---------- */
boot();
dom.heroInstall.hidden = false;
initScrollReveal();
// Surface the designed install banner once for first-time visitors even if the
// native beforeinstallprompt is slow/unavailable (e.g. iOS, desktop).
setTimeout(() => {
  if (!deferredPrompt) showInstallBanner();
}, 4000);
