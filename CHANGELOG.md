# Changelog

All notable changes to Bechdou are documented here.

## [Unreleased] — Marketplace MVP

The first launch-ready build: accounts, closets, listings, checkout, orders,
and an admin dashboard.

### Added

**Authentication**
- Dedicated login, signup, forgot-password and reset-password pages, replacing
  the cramped account sidebar
- Email verification on signup, with resend
- Password reset over single-use links that expire in 1 hour
- Transactional email through Resend's REST API (no npm dependency). Without
  `RESEND_API_KEY` the links are logged to the server console so the flow stays
  testable locally

**Profiles and closets**
- Editable profile with avatar upload, bio, and a unique username
- Public seller closet pages showing avatar, bio, and trust score

**Listings**
- Multi-photo upload, up to 6 per listing, with a real gallery on the product
  page and quick view
- Sellers can edit, delete, and mark their own listings sold

**Checkout and orders**
- Cash on Delivery checkout that remembers buyer details between orders
- Order confirmation page
- Buyers see their purchases with a progress tracker and can cancel before
  dispatch
- Sellers see their sales and can mark orders shipped
- Saved pieces page

**Admin**
- Standalone dashboard with listings, orders, users, payouts, and activity tabs
- Approve, reject, and remove listings
- Suspend and reinstate users
- Seller payout tracking

### Fixed

**Suspension could be bypassed.** Suspension was only checked at login, but
session tokens remain valid for seven days. A suspended user could keep
creating listings and placing orders with an already-issued token. Suspension
is now enforced in the auth middleware and takes effect on the next request.

**Uploaded photos were invisible to buyers.** All uploaded photos were stored,
but the product page and quick view rendered only the cover image. Both now
share a gallery component.

**Listings accepted invalid data.** Negative prices, implausibly large prices,
and whitespace-only titles were all saved. Create and edit now share a single
validator.

**Deleting a listing orphaned live orders.** A seller could delete a piece
mid-fulfilment, leaving the buyer's order pointing at nothing. Deletion is now
rejected while an order is in progress.

**Cancelled orders left pieces unsellable.** Cancelling an order never released
the reservation, so the piece stayed marked sold forever. Cancelling now
returns it to sale; delivery retires it.

**Navigation rendered after page load did not respond.** Click handling was
bound to a snapshot of the DOM taken at load, so buttons inside dynamically
rendered pages — including "Create an account" — did nothing. Replaced with
event delegation.

### Security

- Per-IP rate limiting on login (10 per 15 minutes), signup, and the
  email-sending routes, returning `Retry-After`. Slows credential stuffing and
  prevents the password-reset endpoint being used to send unsolicited mail.
- `forgot-password` returns an identical response whether or not an account
  exists, so it cannot be used to discover registered email addresses.
- Reset and verification tokens are stored only as SHA-256 hashes, so a
  database leak does not yield usable links.
- Minimum password length raised to 8 characters.
- Ownership checks on every listing and order mutation: sellers can only touch
  their own, buyers can only cancel their own.
- Admins cannot suspend their own account, preventing lockout.
