# Vaishali Foods - Astro storefront

A mobile-first branded storefront prepared for Cloudflare Pages.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
3. Framework preset: **Astro**. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy. (The `postbuild.js` script converts Astro's `dist/server` output
   into `dist/_worker.js` which is what Pages expects - no extra setup needed.)

### Enable the admin panel storage (required for saving products/settings)

1. Cloudflare Dashboard -> Storage & Databases -> **KV** -> Create a namespace
   (e.g. `vaishali-db`).
2. Workers & Pages -> your project -> **Settings -> Functions -> KV namespace bindings** ->
   Add binding: Variable name `VAISHALI_DB`, value = your new namespace.
3. Redeploy (or Retry deployment). Until this is bound, the admin panel will
   show an explicit "VAISHALI_DB KV namespace is not bound" error instead of
   silently failing.

### Admin login

- Default username: `vaishali`, default password: `vaishali`.
- Change them immediately in **Settings -> Variables and Secrets** by setting
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_TOKEN` (use a long random string).
- Open `/admin` on your deployed site to sign in.

## Before launch

- Replace `91XXXXXXXXXX` in `src/pages/index.astro` with your WhatsApp number.
- Replace placeholder product images.
- Confirm all prices against the current retail list before launch.
- Add shipping, privacy, refund and terms pages.
- Razorpay and Delhivery require a secure server-side Worker; do not place secret keys in frontend code.

## Delhivery Surface shipping (zone-based rates)

All orders ship from **Nanded, Maharashtra 431605** via **Delhivery Surface**.
Rates are calculated offline in `src/lib/shipping.js` - no courier API
needed at checkout - and the resolved zone is shown on the checkout page.

- **Zone A, Local** (same city as Nanded): base Rs 35.40 + Rs 34.22 per extra 500 g
- **Zone B, Regional** (destination within ~500 km): base Rs 38.94 + Rs 37.76
- **Zone C, Metro to Metro**: base Rs 51.92 + Rs 49.56
- **Zone D, Rest of India**: base Rs 61.36 + Rs 57.82
- **Zone E** (Jammu, Himachal, North East excl. Manipur): base Rs 75.52 + Rs 71.98
- **Zone F** (Kashmir, Manipur, Ladakh, Andaman & Nicobar): base Rs 88.50 + Rs 84.96

Math: the first 500 g (or part) is charged the base fare; every further
500 g slab (or part) adds the additional-slab fare. Chargeable weight is
the higher of actual and volumetric weight (9 x 6 x 3/6 inch box,
divisor 5000 via `DELHIVERY_VOLUMETRIC_DIVISOR`). The total is rounded up
to the next whole rupee.

Zone B ("within 500 km") is approximated with postal-circle prefixes
around Nanded - see `ZONE_B_PREFIXES_2/3` in `src/lib/shipping.js`. If
Delhivery ever bills a nearby destination under a different zone, adjust
those lists to match their panel. After payment, the shipment is booked
with Delhivery (`createDelhiveryShipment` in `src/lib/delhivery.js`).

### Required Cloudflare variables

Add these in **Cloudflare Dashboard -> Workers & Pages -> your project -> Settings -> Variables and Secrets**:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (Secret - encrypt it)
- `ADMIN_TOKEN` (Secret - encrypt it)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET` (Secret)
- `PICKUP_PINCODE` (defaults to 431605 Nanded if unset)
- `DELHIVERY_API_TOKEN` (Secret - needed to auto-book shipments after payment)
- `DELHIVERY_SHIPMENT_API_URL`
- `DELHIVERY_PICKUP_NAME`
- `DELHIVERY_VOLUMETRIC_DIVISOR`

Use `.dev.vars.example` as the local template. Never commit `.dev.vars` or `.env`.
