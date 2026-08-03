// Event wiring for the topbar account menu and page-level actions.
// Loaded after script.js so all handlers and DOM refs already exist.

/* ---------- Account dropdown ---------- */
if (dom.accountTrigger) {
  dom.accountTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = dom.accountDropdown.hidden;
    dom.accountDropdown.hidden = !open;
    dom.accountTrigger.setAttribute("aria-expanded", String(open));
  });
}

document.addEventListener("click", (event) => {
  if (dom.accountMenu && !dom.accountMenu.contains(event.target)) closeAccountDropdown();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAccountDropdown();
});

if (dom.logoutButton) {
  dom.logoutButton.addEventListener("click", async () => {
    API.logout();
    state.selectedListingId = "";
    closeAccountDropdown();
    await refresh();
    switchView("home");
    showToast("Logged out.");
  });
}

/* ---------- Page-level delegated actions ---------- */
document.addEventListener("click", async (event) => {
  const shipButton = event.target.closest("[data-ship-order]");
  if (shipButton) {
    shipButton.disabled = true;
    try {
      await API.shipOrder(shipButton.dataset.shipOrder);
      await refresh();
      renderOrdersPage();
      showToast("Order marked as shipped.");
    } catch (error) {
      shipButton.disabled = false;
      showToast(error.message);
    }
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-my-order]");
  if (cancelButton) {
    if (!window.confirm("Cancel this order? The piece goes back on sale.")) return;
    cancelButton.disabled = true;
    try {
      await API.cancelOrder(cancelButton.dataset.cancelMyOrder);
      await refresh();
      renderOrdersPage();
      showToast("Order cancelled.");
    } catch (error) {
      cancelButton.disabled = false;
      showToast(error.message);
    }
    return;
  }

  const becomeSellerButton = event.target.closest("[data-become-seller]");
  if (becomeSellerButton) {
    becomeSellerButton.disabled = true;
    becomeSellerButton.textContent = "Setting up your closet…";
    try {
      await API.becomeSeller();
      await refresh();
      switchView("sell");
      showToast("You're a seller now — list your first piece.");
    } catch (error) {
      becomeSellerButton.disabled = false;
      becomeSellerButton.textContent = "Become a seller — it's free";
      showToast(error.message);
    }
    return;
  }

  const closetButton = event.target.closest("[data-open-closet]");
  if (closetButton) {
    window.location.hash = `#closet/${encodeURIComponent(closetButton.dataset.openCloset)}`;
    return;
  }
});

/* ---------- Post-login redirects ---------- */
// After a guarded view bounced the visitor to login, resume where they were headed.
const _switchViewBase = switchView;
window.resumePendingNavigation = function resumePendingNavigation() {
  if (pendingCheckoutId) {
    const id = pendingCheckoutId;
    pendingCheckoutId = "";
    openCheckout(id);
    return true;
  }
  if (pendingRedirect) {
    const view = pendingRedirect;
    pendingRedirect = "";
    _switchViewBase(view);
    return true;
  }
  return false;
};

/* ---------- Initial route ---------- */
handleRoute();
