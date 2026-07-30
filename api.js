// Bechdou API client — thin fetch wrapper with bearer-token persistence.
// Exposes a global `API` used by script.js. Same-origin: the Node server
// serves this file and the /api/* endpoints together.
const API = (() => {
  const TOKEN_KEY = "bechdou-token";
  let token = localStorage.getItem(TOKEN_KEY) || "";

  function setToken(next) {
    token = next || "";
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, endpoint, body) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`/api${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error("Cannot reach the Bechdou server. Is it running?");
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.error || `Request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  return {
    get token() {
      return token;
    },
    setToken,
    hasToken: () => Boolean(token),

    bootstrap: () => request("GET", "/bootstrap"),
    me: () => request("GET", "/auth/me"),
    signup: (payload) => request("POST", "/auth/signup", payload),
    login: (payload) => request("POST", "/auth/login", payload),
    logout: () => setToken(""),
    verifyEmail: (token) => request("POST", "/auth/verify-email", { token }),
    resendVerification: () => request("POST", "/auth/resend-verification"),
    forgotPassword: (email) => request("POST", "/auth/forgot-password", { email }),
    resetPassword: (token, password) => request("POST", "/auth/reset-password", { token, password }),

    updateProfile: (payload) => request("PATCH", "/profile", payload),
    seller: (handle) => request("GET", `/sellers/${encodeURIComponent(handle)}`),

    listing: (id) => request("GET", `/listings/${id}`),
    createListing: (payload) => request("POST", "/listings", payload),
    updateListing: (id, payload) => request("PATCH", `/listings/${id}`, payload),
    deleteListing: (id) => request("DELETE", `/listings/${id}`),
    markSold: (id, sold) => request("POST", `/listings/${id}/sold`, { sold }),
    approveListing: (id) => request("POST", `/listings/${id}/approve`),
    rejectListing: (id) => request("POST", `/listings/${id}/reject`),
    toggleSave: (id) => request("POST", `/listings/${id}/save`),

    createOrder: (payload) => request("POST", "/orders", payload),
    orderAction: (id, action) => request("POST", `/orders/${id}/status`, { action }),
    shipOrder: (id) => request("POST", `/orders/${id}/ship`),
    cancelOrder: (id) => request("POST", `/orders/${id}/cancel`),
    setPayout: (id, payoutStatus) => request("POST", `/orders/${id}/payout`, { payoutStatus }),

    accounts: () => request("GET", "/accounts"),
    suspendAccount: (id, suspended) => request("POST", `/accounts/${id}/suspend`, { suspended }),

    reset: () => request("POST", "/reset"),
  };
})();
