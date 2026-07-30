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
      const result = await API.signup(data);
      API.setToken(result.token);
      await refresh();
      renderVerifyNoticePage(result.account.email, result.emailSent);
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
          We sent a verification link to <strong>${esc(email)}</strong>.
          Click it to confirm your account.
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
      const result = await API.resendVerification();
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
    await API.verifyEmail(token);
    await refresh();
    dom.verifyView.innerHTML = `
      <div class="status-shell">
        <div class="status-panel">
          <div class="status-icon is-good">✓</div>
          <h1>Email verified</h1>
          <p>Your account is confirmed. Welcome to Bechdou.</p>
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
          switchView("login");
          showToast("Log in first, then resend the verification email.");
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
