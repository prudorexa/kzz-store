# KZZ Kids Luxe Store

React and Vite storefront backed by Supabase, with M-Pesa checkout, cash on delivery, guest order tracking, and an authenticated admin dashboard.

## Development

```sh
npm install
npm test
npm run dev
```

The shop uses a local demo catalog until Supabase environment variables are configured. Copy `.env.example` to `.env.local` and set:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Production setup

Follow `supabase/SETUP.md` for database migrations, admin roles, Edge Functions, M-Pesa Daraja credentials, guest order access, email delivery, and allowed storefront origins.

## Checks

```sh
npm test
npm run build
```
