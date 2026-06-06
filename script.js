const STORAGE_KEY = "bechdou-mvp-marketplace-v1";
const FALLBACK_IMAGE = "./assets/bechdou-editorial-collage.png";

const seedState = {
  accounts: [
    {
      id: "acct-admin",
      name: "Bechdou Admin",
      email: "admin@bechdou.pk",
      role: "admin",
    },
    {
      id: "acct-seller",
      name: "Aiza Closet",
      email: "aiza@example.com",
      role: "seller",
    },
  ],
  currentUserId: "acct-seller",
  listings: [
    {
      id: "lst-blue-top",
      title: "Powder blue ruched top",
      price: 1450,
      category: "Tops",
      size: "S",
      condition: "Like new",
      location: "Lahore",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Soft summer top with a clean fit and merlot bag styling.",
      image: "./assets/listing-blue-top.png",
      status: "approved",
      createdAt: "2026-06-02T08:30:00.000Z",
    },
    {
      id: "lst-merlot-blouse",
      title: "Merlot satin blouse",
      price: 2200,
      category: "Tops",
      size: "M",
      condition: "Lightly worn",
      location: "Islamabad",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Deep merlot sheen, easy evening piece, no visible flaws.",
      image: "./assets/listing-merlot-blouse.png",
      status: "approved",
      createdAt: "2026-06-03T10:15:00.000Z",
    },
    {
      id: "lst-cardigan-flats",
      title: "Cardigan and ballet flats",
      price: 3900,
      category: "Shoes",
      size: "38",
      condition: "Brand new",
      location: "Karachi",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Cream flats paired with a powder blue cardigan set.",
      image: "./assets/listing-cardigan-flats.png",
      status: "approved",
      createdAt: "2026-06-04T07:45:00.000Z",
    },
    {
      id: "lst-pending-bag",
      title: "Cherry shoulder bag",
      price: 2600,
      category: "Accessories",
      size: "One size",
      condition: "Like new",
      location: "Lahore",
      sellerId: "acct-seller",
      sellerName: "Aiza Closet",
      description: "Structured mini shoulder bag with a glossy merlot finish.",
      image: FALLBACK_IMAGE,
      status: "pending",
      createdAt: "2026-06-05T14:20:00.000Z",
    },
  ],
  orders: [],
  selectedListingId: "",
};

let state = loadState();
let categoryFilter = "all";
let searchQuery = "";
let uploadedImageData = "";
let toastTimer = null;

const dom = {
  navButtons: document.querySelectorAll("[data-view-target]"),
  panels: document.querySelectorAll("[data-view-panel]"),
  categoryButtons: document.querySelectorAll("[data-category]"),
  topStatus: document.getElementById("top-status"),
  approvedCount: document.getElementById("approved-count"),
  requestCount: document.getElementById("request-count"),
  accountCount: document.getElementById("account-count"),
  opsSummary: document.getElementById("ops-summary"),
  accountForm: document.getElementById("account-form"),
  currentAccount: document.getElementById("current-account"),
  searchInput: document.getElementById("search-input"),
  listingGrid: document.getElementById("listing-grid"),
  orderForm: document.getElementById("order-form"),
  requestEmpty: document.getElementById("request-empty"),
  requestSelected: document.getElementById("request-selected"),
  orderName: document.getElementById("order-name"),
  orderContact: document.getElementById("order-contact"),
  orderNote: document.getElementById("order-note"),
  listingForm: document.getElementById("listing-form"),
  imageFile: document.getElementById("listing-image-file"),
  imagePreview: document.getElementById("image-preview"),
  sellerListings: document.getElementById("seller-listings"),
  pendingListings: document.getElementById("pending-listings"),
  orderList: document.getElementById("order-list"),
  resetDemo: document.getElementById("reset-demo"),
  toast: document.getElementById("toast"),
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(seedState);
  } catch (error) {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function activeAccount() {
  return state.accounts.find((account) => account.id === state.currentUserId) || null;
}

function listingById(id) {
  return state.listings.find((listing) => listing.id === id) || null;
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

function statusClass(status) {
  return `status ${escapeHtml(status)}`;
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

function renderCounts() {
  const approved = state.listings.filter((listing) => listing.status === "approved").length;
  const pending = state.listings.filter((listing) => listing.status === "pending").length;
  const rejected = state.listings.filter((listing) => listing.status === "rejected").length;

  dom.approvedCount.textContent = approved;
  dom.requestCount.textContent = state.orders.length;
  dom.accountCount.textContent = state.accounts.length;
  dom.topStatus.textContent = `${pending} pending`;

  dom.opsSummary.innerHTML = [
    ["Pending review", pending],
    ["Approved", approved],
    ["Rejected", rejected],
    ["Requests", state.orders.length],
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

function renderAccount() {
  const account = activeAccount();

  if (!account) {
    dom.currentAccount.hidden = true;
    return;
  }

  dom.currentAccount.hidden = false;
  dom.currentAccount.innerHTML = `
    <strong>${escapeHtml(account.name)}</strong>
    <span>${escapeHtml(account.email)} - ${escapeHtml(account.role)}</span>
  `;
}

function approvedListings() {
  return state.listings
    .filter((listing) => listing.status === "approved")
    .filter((listing) => categoryFilter === "all" || listing.category === categoryFilter)
    .filter((listing) => {
      if (!searchQuery) return true;
      const haystack = [
        listing.title,
        listing.sellerName,
        listing.category,
        listing.size,
        listing.condition,
        listing.location,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function listingCard(listing) {
  return `
    <article class="listing-card">
      <div class="listing-media">
        <img src="${escapeHtml(safeImage(listing.image))}" alt="${escapeHtml(listing.title)}" />
        <span class="badge">${escapeHtml(listing.category)}</span>
      </div>
      <div class="listing-body">
        <div class="listing-title-row">
          <h3>${escapeHtml(listing.title)}</h3>
          <span class="price">${escapeHtml(money(listing.price))}</span>
        </div>
        <p class="listing-meta">
          <span>${escapeHtml(listing.size || "One size")}</span>
          <span>${escapeHtml(listing.condition)}</span>
          <span>${escapeHtml(listing.location || "Pakistan")}</span>
        </p>
        <p class="listing-description">${escapeHtml(listing.description)}</p>
        <button class="button secondary" type="button" data-request-id="${escapeHtml(listing.id)}">
          Request item
        </button>
      </div>
    </article>
  `;
}

function renderBrowse() {
  const listings = approvedListings();
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

function renderRequestPanel() {
  const listing = listingById(state.selectedListingId);
  const account = activeAccount();

  dom.requestEmpty.hidden = Boolean(listing);
  dom.orderForm.hidden = !listing;
  dom.requestEmpty.classList.toggle("is-hidden", Boolean(listing));
  dom.orderForm.classList.toggle("is-hidden", !listing);

  if (!listing) return;

  dom.requestSelected.innerHTML = `
    <span class="status approved">Selected</span>
    <strong>${escapeHtml(listing.title)}</strong>
    <p>${escapeHtml(money(listing.price))} - ${escapeHtml(listing.sellerName)}</p>
  `;

  if (account && !dom.orderName.value) dom.orderName.value = account.name;
  if (account && !dom.orderContact.value) dom.orderContact.value = account.email;
}

function queueItem(listing, options = {}) {
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
        <span class="${statusClass(listing.status)}">${escapeHtml(listing.status)}</span>
        <h4>${escapeHtml(listing.title)}</h4>
        <p class="queue-meta">${escapeHtml(money(listing.price))} - ${escapeHtml(listing.category)} - ${escapeHtml(listing.sellerName)}</p>
        ${actions}
      </div>
    </article>
  `;
}

function renderSellerQueue() {
  const account = activeAccount();
  const listings = state.listings
    .filter((listing) => !account || listing.sellerId === account.id || account.role === "admin")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  dom.sellerListings.innerHTML = listings.length
    ? listings.map((listing) => queueItem(listing)).join("")
    : `
      <div class="empty-state">
        <h3>No listings yet</h3>
        <p>Submitted pieces appear here.</p>
      </div>
    `;
}

function renderAdmin() {
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
        .reverse()
        .map((order) => {
          const listing = listingById(order.listingId);
          return `
            <article class="queue-item">
              <img src="${escapeHtml(safeImage(listing?.image))}" alt="${escapeHtml(listing?.title || "Requested item")}" />
              <div class="queue-copy">
                <span class="status pending">${escapeHtml(order.status)}</span>
                <h4>${escapeHtml(listing?.title || "Requested item")}</h4>
                <p class="queue-meta">${escapeHtml(order.buyerName)} - ${escapeHtml(order.contact)}</p>
                <p class="queue-meta">${escapeHtml(order.note || "No note")}</p>
              </div>
            </article>
          `;
        })
        .join("")
    : `
      <div class="empty-state">
        <h3>No requests yet</h3>
        <p>Buyer item requests appear here.</p>
      </div>
    `;
}

function renderAll() {
  renderCounts();
  renderAccount();
  renderBrowse();
  renderRequestPanel();
  renderSellerQueue();
  renderAdmin();
}

dom.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.viewTarget));
});

dom.categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryFilter = button.dataset.category || "all";
    dom.categoryButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderBrowse();
  });
});

dom.searchInput.addEventListener("input", (event) => {
  searchQuery = event.target.value.trim().toLowerCase();
  renderBrowse();
});

dom.accountForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(dom.accountForm);
  const account = {
    id: makeId("acct"),
    name: form.get("name").trim(),
    email: form.get("email").trim(),
    role: form.get("role"),
  };

  state.accounts.push(account);
  state.currentUserId = account.id;
  dom.accountForm.reset();
  saveState();
  renderAll();
  showToast(`${account.name} is active.`);
});

dom.imageFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  uploadedImageData = "";

  if (!file) {
    dom.imagePreview.innerHTML = "<span>No image selected</span>";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    uploadedImageData = reader.result;
    dom.imagePreview.innerHTML = `<img src="${escapeHtml(uploadedImageData)}" alt="Selected listing preview" />`;
  });
  reader.readAsDataURL(file);
});

dom.listingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const account = activeAccount();

  if (!account) {
    showToast("Create an account first.");
    return;
  }

  const form = new FormData(dom.listingForm);
  const imageUrl = String(form.get("imageUrl") || "").trim();
  const listing = {
    id: makeId("lst"),
    title: form.get("title").trim(),
    price: Number(form.get("price")),
    category: form.get("category"),
    size: form.get("size").trim() || "One size",
    condition: form.get("condition"),
    location: form.get("location").trim() || "Pakistan",
    sellerId: account.id,
    sellerName: account.name,
    description: form.get("description").trim(),
    image: uploadedImageData || imageUrl || FALLBACK_IMAGE,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  state.listings.unshift(listing);
  uploadedImageData = "";
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

  if (!listing) {
    showToast("Select an approved item first.");
    return;
  }

  const order = {
    id: makeId("ord"),
    listingId: listing.id,
    buyerName: dom.orderName.value.trim(),
    contact: dom.orderContact.value.trim(),
    note: dom.orderNote.value.trim(),
    status: "Requested",
    createdAt: new Date().toISOString(),
  };

  state.orders.push(order);
  state.selectedListingId = "";
  dom.orderForm.reset();
  saveState();
  renderAll();
  switchView("admin");
  showToast("Request sent to admin.");
});

document.addEventListener("click", (event) => {
  const requestButton = event.target.closest("[data-request-id]");
  const approveButton = event.target.closest("[data-approve]");
  const rejectButton = event.target.closest("[data-reject]");

  if (requestButton) {
    state.selectedListingId = requestButton.dataset.requestId;
    saveState();
    renderRequestPanel();
    document.querySelector(".request-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (approveButton) {
    const listing = listingById(approveButton.dataset.approve);
    if (listing) {
      listing.status = "approved";
      saveState();
      renderAll();
      showToast("Listing approved.");
    }
  }

  if (rejectButton) {
    const listing = listingById(rejectButton.dataset.reject);
    if (listing) {
      listing.status = "rejected";
      saveState();
      renderAll();
      showToast("Listing rejected.");
    }
  }
});

dom.resetDemo.addEventListener("click", () => {
  state = structuredClone(seedState);
  categoryFilter = "all";
  searchQuery = "";
  uploadedImageData = "";
  dom.searchInput.value = "";
  dom.categoryButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === "all");
  });
  dom.orderForm.reset();
  dom.listingForm.reset();
  dom.imagePreview.innerHTML = "<span>No image selected</span>";
  saveState();
  renderAll();
  switchView("browse");
  showToast("Demo reset.");
});

renderAll();
