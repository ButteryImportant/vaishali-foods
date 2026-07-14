# Vaishali Foods — Astro storefront

A mobile-first branded storefront prepared for Cloudflare Pages.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy.

## Before launch

- Replace `91XXXXXXXXXX` in `src/pages/index.astro` with your WhatsApp number.
- Replace placeholder product images.
- Confirm all prices, especially Khajoor Laddoo and Combo Pack.
- Add shipping, privacy, refund and terms pages.
- Razorpay and Shiprocket require a secure server-side Worker; do not place secret keys in frontend code.
