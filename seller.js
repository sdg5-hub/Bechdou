// Seller listing management — edit, mark sold, delete.

const EDIT_FIELDS = [
  { name: "title", label: "Title", type: "text" },
  { name: "brand", label: "Brand", type: "text" },
  { name: "price", label: "Price", type: "number" },
  { name: "retailPrice", label: "Retail price", type: "number" },
  { name: "size", label: "Size", type: "text" },
  { name: "color", label: "Colour", type: "text" },
];

function openListingEditor(listing) {
  const existing = document.getElementById("listing-editor");
  if (existing) existing.remove();

  const dialog = document.createElement("div");
  dialog.id = "listing-editor";
  dialog.className = "editor-backdrop";
  dialog.innerHTML = `
    <div class="editor-card" role="dialog" aria-modal="true" aria-label="Edit listing">
      <header class="editor-head">
        <h2>Edit listing</h2>
        <button class="plain-button" type="button" data-editor-close aria-label="Close">&times;</button>
      </header>
      <form class="editor-form" id="listing-edit-form">
        <div id="editor-alert"></div>
        <div class="editor-grid">
          ${EDIT_FIELDS.map((field) => `
            <label>${field.label}
              <input type="${field.type}" name="${field.name}"
                value="${esc(listing[field.name] ?? "")}" ${field.name === "title" ? "required" : ""} />
            </label>
          `).join("")}
        </div>
        <label>Condition
          <select name="condition">
            ${["Brand new", "Like new", "Lightly worn", "Vintage wear"].map((c) => `
              <option value="${esc(c)}" ${c === listing.condition ? "selected" : ""}>${esc(c)}</option>
            `).join("")}
          </select>
        </label>
        <label>Category
          <select name="category">
            ${["Tops", "Outerwear", "Shoes", "Accessories"].map((c) => `
              <option value="${esc(c)}" ${c === listing.category ? "selected" : ""}>${esc(c)}</option>
            `).join("")}
          </select>
        </label>
        <label>Description
          <textarea name="description" rows="4">${esc(listing.description || "")}</textarea>
        </label>
        <label>Replace photos (optional)
          <input type="file" id="editor-images" accept="image/*" multiple />
          <span class="auth-hint">Leave empty to keep the current photos.</span>
        </label>
        <div class="editor-actions">
          <button class="button secondary" type="button" data-editor-close>Cancel</button>
          <button class="button primary" type="submit">Save changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(dialog);
  document.body.style.overflow = "hidden";

  const close = () => {
    dialog.remove();
    document.body.style.overflow = "";
  };

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-editor-close]")) close();
  });

  let newImages = [];
  dialog.querySelector("#editor-images").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6);
    newImages = [];
    for (const file of files) {
      newImages.push(await compressImage(await readFileAsDataUrl(file)));
    }
  });

  dialog.querySelector("#listing-edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    delete payload.imageFile;
    if (newImages.length) payload.images = newImages;

    submitState(form, true, "Saving...");
    try {
      await API.updateListing(listing.id, payload);
      await refresh();
      close();
      showToast("Listing updated.");
    } catch (error) {
      form.querySelector("#editor-alert").innerHTML = pageAlert(error.message);
      submitState(form, false);
    }
  });
}

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-seller-edit]");
  const soldButton = event.target.closest("[data-seller-sold]");
  const deleteButton = event.target.closest("[data-seller-delete]");

  if (editButton) {
    const listing = listingById(editButton.dataset.sellerEdit);
    if (listing) openListingEditor(listing);
    return;
  }

  if (soldButton) {
    const listing = listingById(soldButton.dataset.sellerSold);
    if (!listing) return;
    soldButton.disabled = true;
    try {
      await API.markSold(listing.id, !listing.sold);
      await refresh();
      showToast(listing.sold ? "Listing is available again." : "Listing marked sold.");
    } catch (error) {
      soldButton.disabled = false;
      showToast(error.message);
    }
    return;
  }

  if (deleteButton) {
    const listing = listingById(deleteButton.dataset.sellerDelete);
    if (!listing) return;
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    deleteButton.disabled = true;
    try {
      await API.deleteListing(listing.id);
      await refresh();
      showToast("Listing deleted.");
    } catch (error) {
      deleteButton.disabled = false;
      showToast(error.message);
    }
  }
});
