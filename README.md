# Bechdou Marketplace OS

Bechdou is an elevated fashion resale marketplace prototype for proving the core platform loop before building the production backend.

## Repo

- Local repo: `/Users/osamahgilani/Documents/New project/bechdou-site`
- GitHub remote: `git@github.com:sdg5-hub/Bechdou.git`
- Branch: `main`
- Live files: `index.html`, `styles.css`, `script.js`

## Current Upgrade

- Pulse command view with GMV, first-30-day sell-through, time-to-first-sale, recirculation, activity, and CEO questions.
- Local demo signup, login, logout, and account switching for buyer, seller, and admin roles.
- Buyer browse flow with search, category, city, condition, price, sort, saved-only filters, saved listings, and checkout requests.
- Seller studio with richer listing metadata, image upload/URL, QC checklist, listing score, seller metrics, and payout estimate.
- Admin desk with role gate, listing approval/rejection, order lifecycle, payment verification, QC pass, dispatch, delivery, cancellation, account table, and ledger.
- Stripe-first payment model: Stripe Checkout for buyer payment, Stripe Connect for marketplace/seller payouts, and Stripe shipping rates for collecting shipping fees during checkout.

This is still a static prototype. Auth, password storage, payments, image uploads, authorization, and order persistence are browser-local only.

## Locked CEO Decisions

- Marketplace model: open marketplace where anyone can create a seller account and list clothing.
- Admin model: admin moderates listings, payments, QC, and order states.
- First users: broad public/random buyers and sellers, with product designed to make cold users trust the marketplace quickly.
- Payment model: Stripe handles payment infrastructure through Checkout and marketplace payouts through Connect.
- Delivery model: Stripe can collect/display shipping options and shipping charges, but Bechdou still needs courier fulfillment, tracking, delivery support, and order state management.
- North Star Metric: Gross Merchandise Value (GMV) of items bought and sold.
- Leading indicator: first-30-day listing sell-through rate.

## KPI Model

- GMV: total value of completed paid orders.
- First-30-day listing sell-through: percentage of listed items that sell within 30 days.
- Time-to-first-sale: how quickly a new seller makes her first sale.
- Active seller rate: percentage of seller accounts actively listing or managing inventory.
- Listing velocity: number of unique listings created and shared.
- Search-to-buy conversion: percentage of browse/search sessions that become completed checkout.
- Return buyer rate: percentage of buyers with repeat purchases.
- Session length: time spent browsing, saving, and interacting with the feed.
- Recirculation rate: apparel volume kept in circulation instead of heading to waste.

## Demo Accounts

All seeded accounts use:

```text
bechdou123
```

```text
admin@bechdou.pk      admin
aiza@example.com      seller
noor@example.com      seller
mina@example.com      buyer
```

## Brand Direction

- cream: `#F7F3EE`
- powder blue: `#A2BCD7`
- deep merlot: `#6E0F1F`
- title/display type: Cormorant Garamond
- accent script: Pinion Script
- body/product UI: Inter

## Run Locally

```bash
python3 -m http.server 8010
```

Then open:

```text
http://127.0.0.1:8010
```

## Persistence

The app stores demo marketplace state in browser `localStorage`, including accounts, demo password hashes, saved listings, approvals, checkout requests, payment statuses, and audit events. Use `Reset` to return to seeded demo state.

## Production Path

Build the production version as a real app with backend accounts, secure password hashing, sessions, role-based authorization, database persistence, object storage for listing media, Stripe Checkout Session creation, Stripe webhook verification, Stripe Connect seller onboarding/payouts, immutable payment events, seller payout logic, delivery/courier state tracking, and admin-only order state transitions.

Do not trust client-side role checks or client-side payment state in production.

## Remaining CEO Questions

- What minimum trust promise is required for random people to buy from random sellers?
- Does Bechdou hold funds until delivery/QC, or pay sellers immediately after purchase?
- What is the commission/application-fee model inside Stripe Connect?
- Does Bechdou own delivery coordination, or does the seller ship directly with Bechdou visibility?
- What happens when an item is fake, damaged, late, lost, or materially different from the listing?
- What is the exact definition of sold for sell-through: paid, dispatched, delivered, or non-refunded after a window?
- Which product interventions improve 30-day sell-through fastest: pricing suggestions, boosted listings, photo QC, seller coaching, or buyer personalization?
- Which categories should be blocked or restricted in the open marketplace until trust systems mature?
- What is the target first-30-day sell-through rate for launch, month 3, and month 6?
- How will Bechdou measure circularity in a way that is credible enough for brand and investor storytelling?

## CEO-Level Prompt

```text
You are advising the CEO and founding engineering team of Bechdou, an open fashion resale marketplace where anyone can sell clothes, with admin moderation for trust and Stripe as the payment infrastructure. Review the current prototype scope: buyer/seller/admin login, open seller onboarding, listing upload, admin approval, saved listings, Stripe-style checkout requests, Stripe Connect payout planning, QC, dispatch, delivery states, seller metrics, admin ledger, and marketplace pulse metrics.

Produce a CEO-level product and engineering upgrade plan. Optimize for Bechdou's North Star Metric, GMV, and its key leading indicator, first-30-day listing sell-through rate. Prioritize market validation, trust for random buyers/sellers, liquidity, Stripe Checkout, Stripe Connect seller payouts, delivery operations, monetisation, circularity, and operational leverage. Separate the roadmap into MVP hardening, marketplace growth, payment/checkout infrastructure, seller tooling, buyer trust, admin operations, data/analytics, circularity metrics, and production architecture. Call out what not to build yet. Include the first 10 engineering tickets, the core metrics dashboard, and the riskiest assumptions to validate in the next 30 days.
```

## Notes

`script 2.js` is an older duplicate and is not loaded by `index.html`.
