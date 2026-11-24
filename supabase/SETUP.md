# Supabase and M-Pesa setup

## 1. Connect the Supabase project

Create a Supabase project, copy `.env.example` to `.env.local`, and fill in the project URL and publishable/anon key. These two frontend values are public; never put the `service_role` key in a `VITE_` variable.

Install the Supabase CLI, then link and apply the database migration:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create the catalog (including product colour choices), admin roles, orders, stock checks, RLS policies, and public product-image storage. Cash-on-delivery orders reserve stock when placed.

## Environment variables

Create `.env.local` for the frontend:

```sh
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

## 2. Create the first admin

Create an account in **Supabase Dashboard → Authentication → Users**. Copy its user UUID, then run this in the SQL editor:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR_AUTH_USER_UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

The `/admin` route uses Supabase email/password sign-in and checks this role before showing store controls.

## 3. Configure Daraja sandbox

Create a Daraja app and use its sandbox shortcode, passkey, consumer key, and consumer secret. Set the Edge Function secrets (do not put these in `.env.local` or frontend code):

```sh
supabase secrets set \
  MPESA_ENV=sandbox \
  MPESA_SHORTCODE=YOUR_SANDBOX_SHORTCODE \
  MPESA_PASSKEY=YOUR_SANDBOX_PASSKEY \
  MPESA_CONSUMER_KEY=YOUR_DARAJA_CONSUMER_KEY \
  MPESA_CONSUMER_SECRET=YOUR_DARAJA_CONSUMER_SECRET \
  MPESA_CALLBACK_TOKEN=GENERATE_A_LONG_RANDOM_VALUE \
  ALLOWED_ORIGINS=http://localhost:5173
```

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The M-Pesa callback URL is generated from the project URL and callback token.

Deploy the functions (redeploy checkout and order-status after pulling updates):

```sh
supabase functions deploy create-mpesa-checkout
supabase functions deploy order-status
supabase functions deploy mpesa-callback
```

Run `npm run dev` after saving `.env.local`. For a deployed storefront, add its exact HTTPS origin to `ALLOWED_ORIGINS`. Test with Daraja sandbox before changing `MPESA_ENV` to `production`; live use also requires Safaricom production approval and credentials.

Customers can select M-Pesa or cash on delivery at checkout. For cash orders, update the delivery progress in **Admin → Orders**; once marked delivered, use **Mark cash received** after collecting payment.

## 4. Configure secure guest order access

The **My orders** page uses Supabase email one-time codes, so customers can securely view guest orders without setting a password. In **Authentication → Providers → Email**, enable email sign-in and allow new users to sign up. Configure custom SMTP in **Authentication → SMTP Settings** for reliable delivery, then update the **Magic Link** email template to include the one-time code using `{{ .Token }}`.

Deploy the authenticated order lookup function:

```sh
supabase functions deploy customer-orders
```

Customers open **My orders**, enter the email used at checkout, verify the code sent to that inbox, and then see orders placed with that email. The function only returns orders after validating the signed-in, email-verified Supabase user. Customer order access uses a separate browser auth session from the admin login.

## 5. Configure order confirmation email

Order emails are sent by the checkout function through Resend. Set these secrets:

```sh
supabase secrets set \
  RESEND_API_KEY=YOUR_RESEND_API_KEY \
  ORDER_EMAIL_FROM="KZZ Kids Luxe <orders@YOUR_VERIFIED_DOMAIN>" \
  PUBLIC_SITE_URL=https://YOUR_DEPLOYED_STORE
```

Redeploy the checkout function after changing secrets:

```sh
supabase functions deploy create-mpesa-checkout
```
