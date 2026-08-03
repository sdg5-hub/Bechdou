// Bechdou page views — auth, profile, checkout, orders.
// Rendered into the empty [data-view-panel] sections declared in index.html.
// Depends on globals from script.js (state, dom, switchView, refresh, showToast…).

/* =====================================================================
   SHARED HELPERS
   ===================================================================== */
function pageAlert(message, tone = "error") {
  if (!message) return "";
  return `<div class="auth-alert is-${tone}">${esc(message)}</div>`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// Read a param off routes shaped like "#reset-password?token=abc".
function hashParam(name) {
  const query = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(query).get(name) || "";
}

const OAUTH_LABELS = { google: "Google", facebook: "Facebook" };

// Shown on both login and signup — hidden entirely if the server has no
// provider credentials configured, rather than rendering a dead button.
function oauthButtonsHtml() {
  if (!oauthProviders.length) return "";
  return `
    <div class="oauth-buttons">
      ${oauthProviders.map((id) => `
        <a class="button oauth-button oauth-button--${esc(id)}" href="/api/auth/${esc(id)}">
          Continue with ${esc(OAUTH_LABELS[id] || id)}
        </a>
      `).join("")}
    </div>
    <div class="auth-divider"><span>or</span></div>
  `;
}

function submitState(form, busy, busyLabel) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
  } else {
    button.disabled = false;
    if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
  }
}

/* =====================================================================
   LOGIN
   ===================================================================== */
function renderLoginPage(message = "") {
  dom.loginView.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card__head">
          <h1>Welcome back</h1>
          <p>Log in to your closet, orders, and saved pieces.</p>
        </div>
        ${oauthButtonsHtml()}
        <form class="auth-form" id="page-login-form" novalidate>
          <div id="login-alert">${pageAlert(message)}</div>
          <label>Email
            <input type="email" name="email" autocomplete="email" required />
          </label>
          <label>Password
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <div class="auth-meta">
            <button class="link-inline" type="button" data-view-target="forgot-password">Forgot password?</button>
          </div>
          <button class="button primary" type="submit">Log in</button>
        </form>
        <p class="auth-foot">
          New to Bechdou?
          <button class="link-inline" type="button" data-view-target="signup">Create an account</button>
        </p>
      </div>
    </div>
  `;

  dom.loginView.querySelector("#page-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    submitState(form, true, "Logging in…");
    try {
      const result = await API.login({ email: data.email, password: data.password });
      API.setToken(result.token);
      await refresh();
      if (!window.resumePendingNavigation || !window.resumePendingNavigation()) switchView("home");
      showToast(`Welcome back, ${result.account.name}.`);
    } catch (error) {
      form.querySelector("#login-alert").innerHTML = pageAlert(error.message);
      submitState(form, false);
    }
  });
}

/* =====================================================================
   SIGN UP
   ===================================================================== */
function renderSignupPage(message = "") {
  dom.signupView.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card__head">
          <h1>Create your account</h1>
          <p>Buy preloved pieces, or open a closet and sell your own.</p>
        </div>
        ${oauthButtonsHtml()}
        <form class="auth-form" id="page-signup-form" novalidate>
          <div id="signup-alert">${pageAlert(message)}</div>
          <label>Full name
            <input type="text" name="name" autocomplete="name" required />
          </label>
          <label>Email
            <input type="email" name="email" autocomplete="email" required />
          </label>
          <label>Password
            <input type="password" name="password" autocomplete="new-password" minlength="8" required />
            <span class="auth-hint">At least 8 characters.</span>
          </label>
          <div class="auth-row">
            <label>Phone
              <input type="tel" name="phone" autocomplete="tel" placeholder="+92..." />
            </label>
            <label>City
              <input type="text" name="city" autocomplete="address-level2" placeholder="Lahore" />
            </label>
          </div>
          <label>I want to
            <select name="role">
              <option value="buyer">Buy preloved fashion</option>
              <option value="seller">Sell from my closet</option>
            </select>
          </label>
          <button class="button primary" type="submit">Create account</button>
        </form>
        <p class="auth-foot">
          Already have an account?
          <button class="link-inline" type="button" data-view-target="login">Log in</button>
        </p>
      </div>
    </div>
  `;

  dom.signupView.querySelector("#page-signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    submitState(form, true, "Creating account…");
    try {
      // No account exists yet — it is created the moment the emailed link is
      // clicked, so there is nothing to log into here.
      const result = await API.signup(data);
      renderVerifyNoticePage(result.email, result.emailSent);
      switchView("verify-email");
    } catch (error) {
      form.querySelector("#signup-alert").innerHTML = pageAlert(error.message);
      submitState(form, false);
    }
  });
}

/* =====================================================================
   FORGOT PASSWORD
   ===================================================================== */
function renderForgotPage() {
  dom.forgotView.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card__head">
          <h1>Forgot your password?</h1>
          <p>Enter your email and we'll send a link to set a new one.</p>
        </div>
        <form class="auth-form" id="page-forgot-form" novalidate>
          <div id="forgot-alert"></div>
          <label>Email
            <input type="email" name="email" autocomplete="email" required />
          </label>
          <button class="button primary" type="submit">Send reset link</button>
        </form>
        <p class="auth-foot">
          Remembered it?
          <button class="link-inline" type="button" data-view-target="login">Back to log in</button>
        </p>
      </div>
    </div>
  `;

  dom.forgotView.querySelector("#page-forgot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    submitState(form, true, "Sending…");
    try {
      await API.forgotPassword(email);
      // Deliberately identical whether or not the account exists.
      form.querySelector("#forgot-alert").innerHTML = pageAlert(
        `If an account exists for ${email}, a reset link is on its way. The link expires in 1 hour.`,
        "success",
      );
      form.reset();
    } catch (error) {
      form.querySelector("#forgot-alert").innerHTML = pageAlert(error.message);
    }
    submitState(form, false);
  });
}

/* =====================================================================
   RESET PASSWORD
   ===================================================================== */
function renderResetPage() {
  const token = hashParam("token");
  if (!token) {
    dom.resetView.innerHTML = `
      <div class="status-shell">
        <div class="status-panel">
          <div class="status-icon is-bad">!</div>
          <h1>Reset link missing</h1>
          <p>This page needs a valid reset link. Request a new one to continue.</p>
          <div class="status-actions">
            <button class="button primary" type="button" data-view-target="forgot-password">Request new link</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  dom.resetView.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card__head">
          <h1>Choose a new password</h1>
          <p>Pick something you haven't used on Bechdou before.</p>
        </div>
        <form class="auth-form" id="page-reset-form" novalidate>
          <div id="reset-alert"></div>
          <label>New password
            <input type="password" name="password" autocomplete="new-password" minlength="8" required />
            <span class="auth-hint">At least 8 characters.</span>
          </label>
          <label>Confirm new password
            <input type="password" name="confirm" autocomplete="new-password" minlength="8" required />
          </label>
          <button class="button primary" type="submit">Reset password</button>
        </form>
      </div>
    </div>
  `;

  dom.resetView.querySelector("#page-reset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const alertBox = form.querySelector("#reset-alert");

    if (data.password !== data.confirm) {
      alertBox.innerHTML = pageAlert("Those passwords don't match.");
      return;
    }

    submitState(form, true, "Resetting…");
    try {
      const result = await API.resetPassword(token, data.password);
      API.setToken(result.token);
      await refresh();
      window.history.replaceState(null, "", location.pathname);
      switchView("home");
      showToast("Password updated — you're logged in.");
    } catch (error) {
      alertBox.innerHTML = pageAlert(error.message);
      submitState(form, false);
    }
  });
}

/* =====================================================================
   EMAIL VERIFICATION
   ===================================================================== */
function renderVerifyNoticePage(email, emailSent) {
  dom.verifyView.innerHTML = `
    <div class="status-shell">
      <div class="status-panel">
        <div class="status-icon is-good">✉</div>
        <h1>Check your inbox</h1>
        <p>
          We sent a link to <strong>${esc(email)}</strong>. Click it to finish
          creating your account — nothing is created until you do.
          ${emailSent === false ? "<br /><em>Email delivery is not configured on this server yet — the link was written to the server log.</em>" : ""}
        </p>
        <div class="status-actions">
          <button class="button secondary" type="button" id="resend-verification">Resend email</button>
          <button class="button primary" type="button" data-view-target="home">Start browsing</button>
        </div>
      </div>
    </div>
  `;

  dom.verifyView.querySelector("#resend-verification").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      // Not logged in yet (no account exists) — resend by email instead.
      const result = await API.resendVerification(email);
      showToast(result.alreadyVerified ? "Your email is already verified." : "Verification email resent.");
    } catch (error) {
      showToast(error.message);
    }
    button.disabled = false;
    button.textContent = "Resend email";
  });
}

async function renderVerifyResultPage() {
  const token = hashParam("token");
  dom.verifyView.innerHTML = `
    <div class="status-shell">
      <div class="status-panel"><p>Verifying your email…</p></div>
    </div>
  `;

  try {
    // For a fresh signup this is the moment the account is actually created.
    const result = await API.verifyEmail(token);
    if (result.token) API.setToken(result.token);
    await refresh();
    dom.verifyView.innerHTML = `
      <div class="status-shell">
        <div class="status-panel">
          <div class="status-icon is-good">✓</div>
          <h1>Email verified</h1>
          <p>Your account is ready. Welcome to Bechdou, ${esc(result.account?.name || "")}.</p>
          <div class="status-actions">
            <button class="button primary" type="button" data-view-target="home">Start browsing</button>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    dom.verifyView.innerHTML = `
      <div class="status-shell">
        <div class="status-panel">
          <div class="status-icon is-bad">!</div>
          <h1>Verification failed</h1>
          <p>${esc(error.message)}</p>
          <div class="status-actions">
            <button class="button secondary" type="button" id="verify-retry">Send a new link</button>
            <button class="button primary" type="button" data-view-target="home">Go home</button>
          </div>
        </div>
      </div>
    `;
    const retry = dom.verifyView.querySelector("#verify-retry");
    if (retry) {
      retry.addEventListener("click", async () => {
        if (!activeAccount()) {
          // No account exists for an expired signup link — signing up again
          // with the same email replaces the pending request and sends a
          // fresh one.
          switchView("signup");
          showToast("That link expired. Sign up again to get a new one.");
          return;
        }
        try {
          await API.resendVerification();
          showToast("A fresh verification email is on its way.");
        } catch (err) {
          showToast(err.message);
        }
      });
    }
  }
  window.history.replaceState(null, "", location.pathname);
}

/* =====================================================================
   STATIC INFORMATION PAGES  (About, Payments, Buyer Protection, etc.)
   One data-driven renderer instead of duplicating page boilerplate.
   ===================================================================== */
const STATIC_PAGES = {
  about: {
    eyebrow: "Our story",
    title: "About Bechdou",
    body: `
      <p>Bechdou is a community resale marketplace built for Pakistan's mobile-first
      shoppers. We connect people who've outgrown pieces they love with buyers looking
      for something preloved, verified, and priced fairly.</p>
      <p>Every closet on Bechdou is reviewed before it goes live, and every listing is
      checked for photos and honest condition notes before buyers can request it.
      We're a small, early team — if something looks off or you have an idea for us,
      tell us. <button class="link-inline" type="button" data-view-target="contact">Get in touch</button>.</p>
    `,
  },
  payments: {
    eyebrow: "How it works",
    title: "Payments & payouts",
    body: `
      <h2>How buyers pay</h2>
      <p>Bechdou does not use a card gateway. When you check out, you send the full
      amount directly to one of Bechdou's own accounts — JazzCash, EasyPaisa, or bank
      transfer — and enter the transaction ID at checkout. An admin confirms the
      payment landed, then your piece is QC'd and dispatched.</p>
      <h2>How sellers get paid</h2>
      <p>Bechdou keeps a 20% commission on every completed sale to run the platform,
      moderate listings, and handle quality checks. The remaining 80% is sent to the
      seller once the sale is confirmed — sellers can see this breakdown on every order.</p>
      <h2>Why not pay the seller directly?</h2>
      <p>Routing payment through Bechdou first is what makes buyer protection and QC
      possible — if a piece doesn't pass inspection, the sale can be unwound before
      any money reaches the seller.</p>
    `,
  },
  "buyer-protection": {
    eyebrow: "Shop with confidence",
    title: "Buyer Protection",
    body: `
      <p>Every order is QC'd before it leaves a seller's closet. If a listing was
      misrepresented, tell us before you confirm delivery and we'll step in.</p>
      <h2>Cancelling an order</h2>
      <p>You can cancel any order yourself, free, any time before it's marked
      dispatched — find it under <button class="link-inline" type="button" data-view-target="orders">My orders</button>.
      Once an order ships, cancellations go through Bechdou support instead.</p>
      <h2>Payment safety</h2>
      <p>Your payment goes to Bechdou, not directly to a stranger's personal wallet.
      We only release a seller's payout after the sale is confirmed.</p>
    `,
  },
  "shipping-delivery": {
    eyebrow: "Getting your order",
    title: "Shipping & Delivery",
    body: `
      <p>Once your payment is confirmed, sellers dispatch through standard courier
      services nationwide. Delivery timing depends on the seller's city and the
      courier's own schedule — your order page always shows the current status.</p>
      <h2>Tracking your order</h2>
      <p>Check <button class="link-inline" type="button" data-view-target="orders">My orders</button>
      any time for live status: requested, payment confirmed, QC passed, dispatched, delivered.</p>
    `,
  },
  "seller-guide": {
    eyebrow: "For sellers",
    title: "Seller Guide",
    body: `
      <p>Listing on Bechdou is free. Every submission is reviewed by an admin before
      it goes live, so give buyers a reason to trust it.</p>
      <h2>What gets approved fastest</h2>
      <ul>
        <li>Clear front, back, and label photos in good light</li>
        <li>An honest condition note — mention marks, pulls, or repairs</li>
        <li>Accurate measurements, not just a size label</li>
        <li>A fair price relative to the item's retail value and condition</li>
      </ul>
      <h2>Getting paid</h2>
      <p>Bechdou keeps 20% commission per sale; the rest is sent to you once the
      buyer's payment is confirmed. See
      <button class="link-inline" type="button" data-view-target="payments">Payments & payouts</button> for the full breakdown.</p>
    `,
  },
  contact: {
    eyebrow: "We're here",
    title: "Contact us",
    body: `
      <p>The fastest way to reach us is WhatsApp — message us directly and a real
      person will reply.</p>
      <p><a class="button primary" href="https://wa.me/923000000000" target="_blank" rel="noopener">Message us on WhatsApp</a></p>
      <p>For anything about an existing order, include your order number
      (found under <button class="link-inline" type="button" data-view-target="orders">My orders</button>) so we can help faster.</p>
    `,
  },
  terms: {
    eyebrow: "Legal",
    title: "Terms & Conditions",
    body: `
      <p class="static-page-notice">Bechdou is an early-stage marketplace. This page
      is a placeholder outline, not a lawyer-reviewed legal document — it should be
      replaced with real terms before Bechdou takes on the public at scale.</p>
      <p>By using Bechdou, buyers and sellers agree to deal honestly: sellers list
      items they genuinely own and describe accurately; buyers pay only through the
      methods Bechdou provides and do not attempt to transact outside the platform.
      Bechdou may remove listings, suspend accounts, or decline orders that violate
      this at its discretion.</p>
    `,
  },
  privacy: {
    eyebrow: "Legal",
    title: "Privacy Policy",
    body: `
      <p class="static-page-notice">Bechdou is an early-stage marketplace. This page
      is a placeholder outline, not a lawyer-reviewed legal document — it should be
      replaced with a real privacy policy before Bechdou takes on the public at scale.</p>
      <p>Bechdou stores the account, listing, and order information needed to run
      the marketplace: your name, email, phone, delivery address, and order history.
      We do not sell this information to third parties. Payment is handled manually
      by Bechdou admins reviewing the transaction reference you provide — Bechdou
      does not store card numbers, since no card gateway is used.</p>
    `,
  },
};

function renderStaticPage(view) {
  const page = STATIC_PAGES[view];
  const panel = document.querySelector(`[data-view-panel="${view}"]`);
  if (!page || !panel) return;
  panel.innerHTML = `
    <div class="page-shell narrow static-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">${esc(page.eyebrow)}</p>
          <h1>${esc(page.title)}</h1>
        </div>
      </header>
      <div class="static-page-body">${page.body}</div>
    </div>
  `;
}
