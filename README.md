# Bechdou MVP Marketplace

Bechdou is a clean first-version fashion resale marketplace prototype for proving the core platform loop:

- users can create a buyer, seller, or admin profile
- sellers can upload listings
- admins can approve or reject listings before they go public
- buyers can browse approved pieces
- buyers can request an item
- admins can manually handle payment, QC, and delivery outside the product

This MVP intentionally avoids chat, complex payments, delivery tracking, seller wallets, reviews, advanced filters, and large dashboards.

## Brand Direction

The interface follows the Bechdou moodboard direction:

- cream: `#F7F3EE`
- powder blue: `#A2BCD7`
- deep merlot: `#6E0F1F`
- title/display type: Cormorant Garamond
- accent script: Pinion Script
- body/product UI: Inter

## Run Locally

This is a static HTML/CSS/JS site. From the project directory:

```bash
python3 -m http.server 8010
```

Then open:

```text
http://127.0.0.1:8010
```

## Persistence

The app stores demo marketplace state in browser `localStorage`, including accounts, listings, approvals, and buyer requests. Use the `Reset` button in the UI to return to the seeded demo state.

## Files

- `index.html` - marketplace structure and views
- `styles.css` - Bechdou visual system and responsive layout
- `script.js` - local MVP behavior and persistence
- `assets/` - editorial and product imagery for the prototype
