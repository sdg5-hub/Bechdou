// Bechdou admin dashboard — listings moderation, users, orders, payouts.
// Rendered into #admin-view; every action is re-checked server-side by role.

let adminTab = "listings";

const ADMIN_TABS = [
  { id: "listings", label: "Listings" },
  { id: "orders", label: "Orders" },
  { id: "users", label: "Users" },
  { id: "payouts", label: "Payouts" },
  { id: "activity", label: "Activity" },
];

function renderAdmin() {
  if (!dom.adminView) return;

  if (!canAdmin(activeAccount())) {
    dom.adminView.innerHTML = `
      <div class="status-shell">
        <div class="status-panel">
          <div class="status-icon is-bad">!</div>
          <h1>Admin access required</h1>
          <p>Log in with an admin account to open the dashboard.</p>
          <div class="status-actions">
            <button class="button primary" type="button" data-view-target="login">Log in</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const metrics = adminMetrics();

  dom.adminView.innerHTML = `
    <div class="page-shell">
      <header class="page-head">
        <div>
          <p class="eyebrow">Operations</p>
          <h1>Admin dashboard</h1>
        </div>
        <button class="button secondary sm" type="button" id="admin-reset">Reset demo data</button>
      </header>

      <div class="admin-metrics">
        ${adminMetricCard("Pending review", metrics.pending, "listings awaiting approval")}
        ${adminMetricCard("Awaiting payment check", metrics.awaitingConfirmation, "buyer says they paid, unconfirmed")}
        ${adminMetricCard("Open orders", metrics.openOrders, "not yet delivered")}
        ${adminMetricCard("GMV", money(metrics.gmv), "gross merchandise value")}
        ${adminMetricCard("Bechdou's cut", money(metrics.commissionEarned), `${Math.round(COMMISSION_RATE * 100)}% commission earned`)}
        ${adminMetricCard("Owed to sellers", money(metrics.owed), "still to send out")}
        ${adminMetricCard("Users", metrics.users, `${metrics.suspended} suspended`)}
      </div>

      <nav class="admin-tabs" role="tablist">
        ${ADMIN_TABS.map((tab) => `
          <button class="admin-tab ${tab.id === adminTab ? "is-active" : ""}"
            type="button" role="tab" data-admin-tab="${tab.id}"
            aria-selected="${tab.id === adminTab}">${tab.label}</button>
        `).join("")}
      </nav>

      <div class="admin-body">${renderAdminTab()}</div>
    </div>
  `;

  const reset = dom.adminView.querySelector("#admin-reset");
  if (reset) reset.addEventListener("click", handleAdminReset);
}

function adminMetricCard(label, value, caption) {
  return `
    <article class="admin-metric">
      <span class="admin-metric__label">${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <span class="admin-metric__caption">${esc(caption)}</span>
    </article>
  `;
}

function adminMetrics() {
  const listings = state.listings;
  const orders = state.orders;
  const delivered = orders.filter((o) => o.status === "Delivered");
  const confirmed = orders.filter((o) => o.status !== "Cancelled" && o.paymentStatus !== "Awaiting confirmation");
  const owed = confirmed.filter((o) => o.payoutStatus !== "paid");

  return {
    pending: listings.filter((l) => l.status === "pending").length,
    approved: listings.filter((l) => l.status === "approved").length,
    openOrders: orders.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled").length,
    awaitingConfirmation: orders.filter((o) => o.paymentStatus === "Awaiting confirmation").length,
    gmv: delivered.reduce((sum, o) => sum + Number(o.amount || 0), 0),
    commissionEarned: confirmed.reduce((sum, o) => sum + commissionForOrder(o), 0),
    owed: owed.reduce((sum, o) => sum + payoutForOrder(o), 0),
    users: state.accounts.length,
    suspended: state.accounts.filter((a) => a.suspended).length,
  };
}

function renderAdminTab() {
  switch (adminTab) {
    case "orders": return adminOrdersTable();
    case "users": return adminUsersTable();
    case "payouts": return adminPayoutsTable();
    case "activity": return adminActivityList();
    default: return adminListingsTable();
  }
}

function adminEmpty(message) {
  return `<p class="empty-note">${esc(message)}</p>`;
}

/* ---------- Listings moderation ---------- */
function adminListingsTable() {
  const pending = state.listings.filter((l) => l.status === "pending");
  const others = state.listings.filter((l) => l.status !== "pending");

  const row = (listing) => `
    <article class="admin-row">
      <img src="${esc(safeImage(listing.image))}" alt="${esc(listing.title)}" />
      <div class="admin-row__main">
        <strong>${esc(listing.title)}</strong>
        <span>${esc(listing.brand)} &middot; ${esc(listing.category)} &middot; ${esc(listing.size || "One size")}</span>
        <span class="admin-row__meta">${esc(listing.sellerName || "Unknown seller")} &middot; ${esc(listing.location || "")}</span>
      </div>
      <div class="admin-row__side">
        <strong>${esc(money(listing.price))}</strong>
        <span class="status ${listing.status === "approved" ? "approved" : listing.status === "rejected" ? "rejected" : "pending"}">
          ${esc(listing.sold ? "sold" : listing.status)}
        </span>
      </div>
      <div class="admin-row__actions">
        ${listing.status !== "approved" ? `<button class="button primary sm" type="button" data-admin-approve="${esc(listing.id)}">Approve</button>` : ""}
        ${listing.status !== "rejected" ? `<button class="button secondary sm" type="button" data-admin-reject="${esc(listing.id)}">Reject</button>` : ""}
        <button class="button danger sm" type="button" data-admin-remove="${esc(listing.id)}">Remove</button>
      </div>
    </article>
  `;

  return `
    <section class="admin-section">
      <h2>Awaiting review <span class="count-pill">${pending.length}</span></h2>
      <div class="admin-list">${pending.length ? pending.map(row).join("") : adminEmpty("Nothing waiting for review.")}</div>
    </section>
    <section class="admin-section">
      <h2>All listings <span class="count-pill">${others.length}</span></h2>
      <div class="admin-list">${others.length ? others.map(row).join("") : adminEmpty("No listings yet.")}</div>
    </section>
  `;
}

/* ---------- Orders desk ---------- */
const ADMIN_ORDER_ACTIONS = [
  { action: "paid", label: "Confirm payment received" },
  { action: "qc", label: "QC pass" },
  { action: "dispatch", label: "Dispatch" },
  { action: "delivered", label: "Delivered" },
  { action: "cancel", label: "Cancel", tone: "danger" },
];

function adminOrdersTable() {
  if (!state.orders.length) return adminEmpty("No orders yet.");

  return `
    <section class="admin-section">
      <h2>All orders <span class="count-pill">${state.orders.length}</span></h2>
      <div class="admin-list">
        ${state.orders.map((order) => {
          const listing = listingById(order.listingId);
          const methodLabel = paymentOptionById(order.paymentMethod)?.label || order.paymentMethod;
          return `
            <article class="admin-row">
              <img src="${esc(safeImage(listing?.image))}" alt="${esc(listing?.title || "Item")}" />
              <div class="admin-row__main">
                <strong>${esc(listing?.title || "Removed listing")}</strong>
                <span>${esc(order.buyerName || "")} &middot; ${esc(order.contact || "")}</span>
                <span class="admin-row__meta">
                  ${esc(order.id)} &middot; ${esc(order.deliveryAddress || "")} ${esc(order.deliveryCity || "")}
                </span>
                <span class="admin-row__meta admin-row__payment">
                  Paid via <strong>${esc(methodLabel)}</strong> &middot; ref <strong>${esc(order.paymentReference || "—")}</strong>
                </span>
              </div>
              <div class="admin-row__side">
                <strong>${esc(money(order.amount))}</strong>
                <span class="status ${order.status === "Delivered" ? "approved" : order.status === "Cancelled" ? "rejected" : "pending"}">${esc(order.status)}</span>
                <span class="admin-row__meta">${esc(order.paymentStatus || "")}</span>
              </div>
              <div class="admin-row__actions">
                ${ADMIN_ORDER_ACTIONS.map((a) => `
                  <button class="button ${a.tone === "danger" ? "danger" : "secondary"} sm"
                    type="button" data-admin-order="${esc(order.id)}" data-admin-action="${a.action}">${a.label}</button>
                `).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

/* ---------- Users ---------- */
function adminUsersTable() {
  const me = activeAccount();

  return `
    <section class="admin-section">
      <h2>All users <span class="count-pill">${state.accounts.length}</span></h2>
      <div class="admin-list">
        ${state.accounts.map((account) => {
          const listings = state.listings.filter((l) => l.sellerId === account.id).length;
          const orders = state.orders.filter((o) => o.buyerId === account.id).length;
          const isSelf = account.id === me.id;
          return `
            <article class="admin-row is-compact">
              <span class="admin-avatar">${esc(initials(account.name))}</span>
              <div class="admin-row__main">
                <strong>${esc(account.name)} ${account.suspended ? `<span class="status rejected">Suspended</span>` : ""}</strong>
                <span>${esc(account.email)}</span>
                <span class="admin-row__meta">${esc(account.city || "")} &middot; ${listings} listings &middot; ${orders} orders</span>
              </div>
              <div class="admin-row__side">
                <span class="status ${account.role === "admin" ? "approved" : "pending"}">${esc(account.role)}</span>
                ${account.emailVerified ? `<span class="admin-row__meta">Verified</span>` : `<span class="admin-row__meta">Unverified</span>`}
              </div>
              <div class="admin-row__actions">
                ${isSelf
                  ? `<span class="admin-row__meta">This is you</span>`
                  : `<button class="button ${account.suspended ? "secondary" : "danger"} sm" type="button"
                       data-admin-suspend="${esc(account.id)}" data-suspend-next="${account.suspended ? "false" : "true"}">
                       ${account.suspended ? "Reinstate" : "Suspend"}
                     </button>`}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

/* ---------- Payouts ---------- */
function adminPayoutsTable() {
  const awaitingCheck = state.orders.filter((o) => o.paymentStatus === "Awaiting confirmation");
  const payable = state.orders.filter(
    (o) => o.status !== "Cancelled" && o.paymentStatus !== "Awaiting confirmation",
  );
  if (!payable.length && !awaitingCheck.length) return adminEmpty("No orders yet.");

  return `
    <section class="admin-section">
      <h2>Seller payouts <span class="count-pill">${payable.length}</span></h2>
      <p class="auth-hint">
        Bechdou keeps ${Math.round(COMMISSION_RATE * 100)}% of every confirmed sale; the rest goes to the seller.
      </p>

      ${awaitingCheck.length ? `
        <p class="admin-note is-warning">
          ${awaitingCheck.length} order${awaitingCheck.length === 1 ? "" : "s"} still need${awaitingCheck.length === 1 ? "s" : ""}
          the buyer's payment confirmed on the <strong>Orders</strong> tab before a payout can be worked out.
        </p>
      ` : ""}

      <div class="admin-list">
        ${payable.map((order) => {
          const listing = listingById(order.listingId);
          const seller = accountById(order.sellerId);
          const paid = order.payoutStatus === "paid";
          const commission = commissionForOrder(order);
          const payout = payoutForOrder(order);
          return `
            <article class="admin-row is-compact payout-row">
              <span class="admin-avatar">${esc(initials(seller?.name || listing?.sellerName || "S"))}</span>
              <div class="admin-row__main">
                <strong>${esc(seller?.name || listing?.sellerName || "Seller")}</strong>
                <span>${esc(listing?.title || "Removed listing")}</span>
                <span class="admin-row__meta">${esc(order.id)} &middot; ${esc(order.status)}</span>
              </div>
              <div class="payout-breakdown">
                <div><span>Buyer paid</span><strong>${esc(money(order.amount))}</strong></div>
                <div><span>Bechdou keeps</span><strong>${esc(money(commission))}</strong></div>
                <div class="is-emphasis"><span>Send to seller</span><strong>${esc(money(payout))}</strong></div>
              </div>
              <div class="admin-row__side">
                <span class="status ${paid ? "approved" : "pending"}">${paid ? "Sent to seller" : "Not sent yet"}</span>
              </div>
              <div class="admin-row__actions">
                <button class="button ${paid ? "secondary" : "primary"} sm" type="button"
                  data-admin-payout="${esc(order.id)}" data-payout-next="${paid ? "unpaid" : "paid"}">
                  ${paid ? "Mark not sent" : `Mark ${esc(money(payout))} sent`}
                </button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

/* ---------- Activity ---------- */
function adminActivityList() {
  if (!state.auditLog.length) return adminEmpty("No activity recorded yet.");
  return `
    <section class="admin-section">
      <h2>Activity log</h2>
      <div class="admin-list">
        ${state.auditLog.map((event) => `
          <article class="admin-row is-log">
            <span class="status pending">${esc(event.type)}</span>
            <div class="admin-row__main">
              <strong>${esc(event.message)}</strong>
              <span class="admin-row__meta">${esc(new Date(event.createdAt).toLocaleString())}</span>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

/* ---------- Actions ---------- */
async function handleAdminReset() {
  if (!window.confirm("Reset all demo data? This restores the seeded listings, orders and accounts.")) return;
  try {
    await API.reset();
    await refresh();
    renderAdmin();
    showToast("Demo data restored.");
  } catch (error) {
    showToast(error.message);
  }
}

document.addEventListener("click", async (event) => {
  const tabButton = event.target.closest("[data-admin-tab]");
  if (tabButton) {
    adminTab = tabButton.dataset.adminTab;
    renderAdmin();
    return;
  }

  const approve = event.target.closest("[data-admin-approve]");
  const reject = event.target.closest("[data-admin-reject]");
  const remove = event.target.closest("[data-admin-remove]");
  const orderButton = event.target.closest("[data-admin-order]");
  const suspend = event.target.closest("[data-admin-suspend]");
  const payout = event.target.closest("[data-admin-payout]");

  const run = async (fn, message, button) => {
    if (button) button.disabled = true;
    try {
      await fn();
      await refresh();
      renderAdmin();
      showToast(message);
    } catch (error) {
      if (button) button.disabled = false;
      showToast(error.message);
    }
  };

  if (approve) return run(() => API.approveListing(approve.dataset.adminApprove), "Listing approved.", approve);
  if (reject) return run(() => API.rejectListing(reject.dataset.adminReject), "Listing rejected.", reject);

  if (remove) {
    if (!window.confirm("Remove this listing permanently?")) return;
    return run(() => API.deleteListing(remove.dataset.adminRemove), "Listing removed.", remove);
  }

  if (orderButton) {
    const action = orderButton.dataset.adminAction;
    if (action === "cancel" && !window.confirm("Cancel this order?")) return;
    return run(
      () => API.orderAction(orderButton.dataset.adminOrder, action),
      `Order updated: ${action}.`,
      orderButton,
    );
  }

  if (suspend) {
    const next = suspend.dataset.suspendNext === "true";
    if (next && !window.confirm("Suspend this user? They will not be able to log in.")) return;
    return run(
      () => API.suspendAccount(suspend.dataset.adminSuspend, next),
      next ? "User suspended." : "User reinstated.",
      suspend,
    );
  }

  if (payout) {
    return run(
      () => API.setPayout(payout.dataset.adminPayout, payout.dataset.payoutNext),
      "Payout status updated.",
      payout,
    );
  }
});
