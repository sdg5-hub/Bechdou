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

  // Nav entries that point at a section of the home page (e.g. FAQ).
  const sectionJump = event.target.closest("[data-section-jump]");
  if (sectionJump) {
    const target = () => document.getElementById(sectionJump.dataset.sectionJump);
    const alreadyHome = document
      .querySelector('[data-view-panel="home"]')
      ?.classList.contains("is-active");

    if (alreadyHome) {
      // Scroll straight there — calling switchView would fire its own smooth
      // scroll to the top and fight this one.
      target()?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    switchView("home");
    // Coming from another view, let switchView's scroll-to-top settle first.
    setTimeout(() => target()?.scrollIntoView({ behavior: "smooth", block: "start" }), 360);
    return;
  }

  // Search icon in the topbar: open Browse and put the cursor in the field.
  // switchView kicks off a smooth scroll, so focus is deferred past it —
  // focusing mid-scroll gets dropped.
  if (event.target.closest("[data-search-jump]")) {
    switchView("browse");
    setTimeout(() => dom.searchInput?.focus(), 320);
    return;
  }
});

/* ---------- Newsletter signup (main section + footer mini-form) ---------- */
document.addEventListener("submit", async (event) => {
  const form = event.target.closest("#newsletter-form, #newsletter-form-footer");
  if (!form) return;
  event.preventDefault();

  const isFooter = form.id === "newsletter-form-footer";
  const note = document.getElementById(isFooter ? "newsletter-note-footer" : "newsletter-note");
  const email = new FormData(form).get("email");
  const button = form.querySelector("button[type=submit]");

  button.disabled = true;
  try {
    const result = await API.subscribeNewsletter(email);
    if (note) {
      note.textContent = result.alreadySubscribed
        ? "You're already on the list."
        : "You're on the list — welcome!";
    }
    form.reset();
  } catch (error) {
    if (note) note.textContent = error.message;
  }
  button.disabled = false;
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
