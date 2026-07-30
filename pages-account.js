// Bechdou account pages — profile, checkout, order confirmation, orders.
// Shares helpers with pages.js (esc, pageAlert, submitState) and script.js.

/* =====================================================================
   MY PROFILE
   ===================================================================== */
function renderProfilePage() {
  const account = activeAccount();
  if (!account) return;

  const myListings = state.listings.filter((l) => l.sellerId === account.id);
  const handle = (account.handle || "").replace(/^@/, "");
  const avatarStyle = account.avatar ? `background-image:url("${esc(account.avatar)}")` : "";

  dom.profileView.innerHTML = `
    <div class="page-shell">
      <header class="page-head">
        <div>
          <p class="eyebrow">Account</p>
          <h1>My profile</h1>
        </div>
        ${account.emailVerified
          ? `<span class="status approved">Email verified</span>`
          : `<button class="button secondary sm" type="button" id="profile-resend">Verify email</button>`}
      </header>

      <div class="profile-layout">
        <form class="profile-card" id="profile-form" novalidate>
          <div id="profile-alert"></div>

          <div class="avatar-field">
            <span class="profile-avatar" id="profile-avatar-preview" style="${avatarStyle}">${account.avatar ? "" : esc(initials(account.name))}</span>
            <div>
              <label class="button secondary sm" for="profile-avatar-input">Change photo</label>
              <input type="file" id="profile-avatar-input" accept="image/*" hidden />
              <p class="auth-hint">JPG or PNG, up to 2MB.</p>
            </div>
          </div>

          <label>Full name
            <input type="text" name="name" value="${esc(account.name)}" required />
          </label>
          <label>Username
            <input type="text" name="handle" value="${esc(handle)}" />
            <span class="auth-hint">Your public closet URL uses this name.</span>
          </label>
          <label>Bio
            <textarea name="bio" rows="3" placeholder="Tell buyers about your closet...">${esc(account.bio || "")}</textarea>
          </label>
          <div class="auth-row">
            <label>Phone
              <input type="tel" name="phone" value="${esc(account.phone || "")}" />
            </label>
            <label>City
              <input type="text" name="city" value="${esc(account.city || "")}" />
            </label>
          </div>
          <button class="button primary" type="submit">Save changes</button>
        </form>

        <aside class="profile-side">
          <div class="profile-stat-card">
            <p class="eyebrow">Account</p>
            <div class="profile-stats">
              <div><strong>${esc(account.role)}</strong><span>Role</span></div>
              <div><strong>${myListings.length}</strong><span>Listings</span></div>
              <div><strong>${account.trustScore || 80}%</strong><span>Trust</span></div>
            </div>
            <p class="auth-hint">${esc(account.email)}</p>
          </div>
          ${canSell(account) ? `
            <div class="profile-stat-card">
              <p class="eyebrow">Closet</p>
              <p class="auth-hint">See your closet the way buyers do.</p>
              <button class="button secondary sm" type="button" data-open-closet="${esc(account.name)}">View my closet</button>
            </div>` : ""}
        </aside>
      </div>
    </div>
  `;

  let avatarData = "";
  const avatarInput = dom.profileView.querySelector("#profile-avatar-input");
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      dom.profileView.querySelector("#profile-alert").innerHTML = pageAlert("That image is larger than 2MB.");
      avatarInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      avatarData = reader.result;
      const preview = dom.profileView.querySelector("#profile-avatar-preview");
      preview.style.backgroundImage = `url("${avatarData}")`;
      preview.textContent = "";
    };
    reader.readAsDataURL(file);
  });

  const resend = dom.profileView.querySelector("#profile-resend");
  if (resend) {
    resend.addEventListener("click", async () => {
      resend.disabled = true;
      try {
        await API.resendVerification();
        showToast("Verification email sent — check your inbox.");
      } catch (error) {
        showToast(error.message);
      }
      resend.disabled = false;
    });
  }

  dom.profileView.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    if (avatarData) payload.avatar = avatarData;
    submitState(form, true, "Saving...");
    try {
      await API.updateProfile(payload);
      await refresh();
      showToast("Profile updated.");
      renderProfilePage();
    } catch (error) {
      form.querySelector("#profile-alert").innerHTML = pageAlert(error.message);
      submitState(form, false);
    }
  });
}

/* =====================================================================
   SAVED PIECES
   ===================================================================== */
function renderSavedPage() {
  const account = activeAccount();
  if (!account) return;

  const saved = state.listings.filter(
    (l) => l.status === "approved" && account.savedListingIds?.includes(l.id),
  );

  dom.savedView.innerHTML = `
    <div class="page-shell">
      <header class="page-head">
        <div>
          <p class="eyebrow">Your edit</p>
          <h1>Saved pieces</h1>
        </div>
        <span class="count-pill">${saved.length}</span>
      </header>

      ${saved.length
        ? `<div class="listing-grid" role="list">${saved.map(listingCard).join("")}</div>`
        : `<p class="empty-note">
             Nothing saved yet. Tap the heart on any piece to keep it here.
             <button class="link-inline" type="button" data-view-target="browse">Browse the drop</button>
           </p>`}
    </div>
  `;
}

/* =====================================================================
   CHECKOUT  (Cash on Delivery)
   ===================================================================== */
const BUYER_INFO_KEY = "bechdou-buyer-info";

function savedBuyerInfo() {
  try {
    return JSON.parse(localStorage.getItem(BUYER_INFO_KEY)) || {};
  } catch {
    return {};
  }
}

function openCheckout(listingId) {
  const account = activeAccount();
  if (!account) {
    pendingCheckoutId = listingId;
    switchView("login");
    showToast("Log in to complete your order.");
    return;
  }
  renderCheckoutPage(listingId);
  switchView("checkout");
}

let pendingCheckoutId = "";

function renderCheckoutPage(listingId) {
  const account = activeAccount();
  const listing = listingById(listingId);

  if (!listing) {
    dom.checkoutView.innerHTML = `
      <div class="status-shell">
        <div class="status-panel">
          <div class="status-icon is-bad">!</div>
          <h1>Piece unavailable</h1>
          <p>This listing is no longer available.</p>
          <div class="status-actions">
            <button class="button primary" type="button" data-view-target="browse">Back to browse</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const seller = accountById(listing.sellerId);
  const saved = savedBuyerInfo();

  dom.checkoutView.innerHTML = `
    <div class="page-shell narrow">
      <header class="page-head">
        <div>
          <p class="eyebrow">Checkout</p>
          <h1>Confirm your order</h1>
        </div>
      </header>

      <div class="checkout-layout">
        <form class="checkout-form" id="checkout-form" novalidate>
          <div id="checkout-alert"></div>

          <fieldset class="checkout-fieldset">
            <legend>Delivery details</legend>
            <label>Full name
              <input type="text" name="buyerName" value="${esc(saved.buyerName || account.name)}" required />
            </label>
            <label>Contact number
              <input type="tel" name="contact" value="${esc(saved.contact || account.phone || "")}" placeholder="+92..." required />
            </label>
            <label>Delivery address
              <textarea name="deliveryAddress" rows="3" required placeholder="House, street, area">${esc(saved.deliveryAddress || "")}</textarea>
            </label>
            <label>City
              <input type="text" name="deliveryCity" value="${esc(saved.deliveryCity || account.city || "")}" required />
            </label>
            <label>Note for the seller (optional)
              <textarea name="note" rows="2" placeholder="Size question, delivery timing..."></textarea>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="remember" checked />
              <span>Save these details for next time</span>
            </label>
          </fieldset>

          <fieldset class="checkout-fieldset">
            <legend>Payment</legend>
            <div class="payment-choice is-selected">
              <div>
                <strong>Cash on Delivery</strong>
                <span>Pay the courier in cash when your order arrives.</span>
              </div>
              <span class="status approved">Selected</span>
            </div>
          </fieldset>

          <button class="button primary lg" type="submit">Place order</button>
        </form>

        <aside class="checkout-summary">
          <h2>Order summary</h2>
          <div class="summary-item">
            <img src="${esc(safeImage(listing.image))}" alt="${esc(listing.title)}" />
            <div>
              <strong>${esc(listing.title)}</strong>
              <span>${esc(listing.brand)} · ${esc(listing.size || "One size")}</span>
              <span>${esc(listing.condition)}</span>
            </div>
          </div>
          <div class="summary-row">
            <span>Seller</span>
            <strong>${esc(seller?.name || listing.sellerName || "Bechdou seller")}</strong>
          </div>
          <div class="summary-row">
            <span>Item price</span>
            <strong>${esc(money(listing.price))}</strong>
          </div>
          <div class="summary-row">
            <span>Delivery</span>
            <strong>Paid on delivery</strong>
          </div>
          <div class="summary-row is-total">
            <span>Total due</span>
            <strong>${esc(money(listing.price))}</strong>
          </div>
          <p class="auth-hint">You can inspect the piece at your door before paying.</p>
        </aside>
      </div>
    </div>
  `;

  dom.checkoutView.querySelector("#checkout-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    submitState(form, true, "Placing order...");

    try {
      const result = await API.createOrder({
        listingId: listing.id,
        buyerName: data.buyerName,
        contact: data.contact,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        note: data.note,
      });

      if (data.remember) {
        localStorage.setItem(BUYER_INFO_KEY, JSON.stringify({
          buyerName: data.buyerName,
          contact: data.contact,
          deliveryAddress: data.deliveryAddress,
          deliveryCity: data.deliveryCity,
        }));
      }

      await refresh();
      renderConfirmationPage(result.order, listing);
      switchView("confirmation");
    } catch (error) {
      form.querySelector("#checkout-alert").innerHTML = pageAlert(error.message);
      submitState(form, false);
    }
  });
}

/* =====================================================================
   ORDER CONFIRMATION
   ===================================================================== */
function renderConfirmationPage(order, listing) {
  dom.confirmationView.innerHTML = `
    <div class="status-shell">
      <div class="status-panel">
        <div class="status-icon is-good">&#10003;</div>
        <h1>Order placed</h1>
        <p>
          Your order for <strong>${esc(listing?.title || "your piece")}</strong> is confirmed.
          We will QC it before dispatch, and you pay
          <strong>${esc(money(order.amount))}</strong> in cash on delivery.
        </p>
        <div class="confirmation-detail">
          <div><span>Order number</span><strong>${esc(order.id)}</strong></div>
          <div><span>Delivering to</span><strong>${esc(order.deliveryCity || "")}</strong></div>
          <div><span>Payment</span><strong>Cash on Delivery</strong></div>
        </div>
        <div class="status-actions">
          <button class="button primary" type="button" data-view-target="orders">Track my order</button>
          <button class="button secondary" type="button" data-view-target="browse">Keep shopping</button>
        </div>
      </div>
    </div>
  `;
}

/* =====================================================================
   ORDERS  (buyer purchases + seller sales)
   ===================================================================== */
function orderStatusTone(status) {
  if (status === "Delivered") return "approved";
  if (status === "Cancelled") return "rejected";
  return "pending";
}

// Visual progress through the fulfilment lifecycle.
const ORDER_STEPS = ["Requested", "Payment received", "QC passed", "Dispatched", "Delivered"];

function orderTracker(order) {
  if (order.status === "Cancelled") {
    return `<p class="order-track is-cancelled">This order was cancelled.</p>`;
  }
  const reached = Math.max(0, ORDER_STEPS.indexOf(order.status));
  return `
    <ol class="order-track" aria-label="Order progress">
      ${ORDER_STEPS.map((step, i) => `
        <li class="${i <= reached ? "is-done" : ""} ${i === reached ? "is-current" : ""}">
          <span class="order-track__dot" aria-hidden="true"></span>
          <span class="order-track__label">${esc(step)}</span>
        </li>
      `).join("")}
    </ol>
  `;
}

function orderRow(order, perspective) {
  const listing = listingById(order.listingId);
  const counterpartyName = perspective === "buyer"
    ? (accountById(order.sellerId)?.name || listing?.sellerName || "Bechdou seller")
    : order.buyerName;

  const canShip = perspective === "seller" && !order.shippedAt && order.status !== "Cancelled";
  const canCancel = perspective === "buyer"
    && !order.shippedAt
    && !["Cancelled", "Dispatched", "Delivered"].includes(order.status);

  return `
    <article class="order-row">
      <img class="order-thumb" src="${esc(safeImage(listing?.image))}" alt="${esc(listing?.title || "Item")}" />
      <div class="order-main">
        <strong>${esc(listing?.title || "Removed listing")}</strong>
        <span>${perspective === "buyer" ? "Sold by" : "Buyer"}: ${esc(counterpartyName || "-")}</span>
        <span class="order-meta">${esc(order.id)} &middot; ${esc(new Date(order.createdAt).toLocaleDateString())} &middot; ${esc(order.paymentStatus || "")}</span>
        ${perspective === "buyer" ? orderTracker(order) : ""}
      </div>
      <div class="order-side">
        <strong>${esc(money(order.amount))}</strong>
        <span class="status ${orderStatusTone(order.status)}">${esc(order.status)}</span>
        ${canShip ? `<button class="button primary sm" type="button" data-ship-order="${esc(order.id)}">Mark shipped</button>` : ""}
        ${canCancel ? `<button class="button danger sm" type="button" data-cancel-my-order="${esc(order.id)}">Cancel order</button>` : ""}
      </div>
    </article>
  `;
}

function renderOrdersPage() {
  const account = activeAccount();
  if (!account) return;

  const purchases = state.orders.filter((o) => o.buyerId === account.id);
  const sales = state.orders.filter((o) => o.sellerId === account.id);

  dom.ordersView.innerHTML = `
    <div class="page-shell">
      <header class="page-head">
        <div>
          <p class="eyebrow">Activity</p>
          <h1>My orders</h1>
        </div>
      </header>

      <section class="order-block">
        <h2>Purchases</h2>
        <div class="order-list">
          ${purchases.length
            ? purchases.map((o) => orderRow(o, "buyer")).join("")
            : `<p class="empty-note">No purchases yet. <button class="link-inline" type="button" data-view-target="browse">Browse pieces</button></p>`}
        </div>
      </section>

      ${canSell(account) ? `
        <section class="order-block">
          <h2>Sales</h2>
          <div class="order-list">
            ${sales.length
              ? sales.map((o) => orderRow(o, "seller")).join("")
              : `<p class="empty-note">No sales yet. Approved listings show up in Browse for buyers.</p>`}
          </div>
        </section>` : ""}
    </div>
  `;
}
