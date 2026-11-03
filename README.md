# Ordering Store

A simple ordering website with categories → subcategories → products, a cart with live totals,
checkout tied to the customer's phone number, secure order tracking, and a full admin panel.

**Stack (all free tiers, no build step, edit everything in the browser):**

| Part | Service | Cost |
|---|---|---|
| Code + editing | GitHub (web editor) | Free |
| Hosting + HTTPS | GitHub Pages (public repo) | Free |
| Database, admin login, images | Supabase | Free |
| Domain | Your Hostinger domain | What you already pay |

---

## Files

```
index.html          Storefront
admin.html          Admin panel  (yoursite.com/admin)
css/style.css       All styles
js/config.js        ← the ONLY file you must edit (Supabase URL + key)
js/common.js        Shared helpers + every default text
js/store.js         Storefront logic
js/admin.js         Admin logic
.nojekyll           Tells GitHub Pages to serve files as-is
supabase/schema.sql Database, security rules, image storage
```

---

## Step-by-step setup (≈ 30 minutes, no software to install)

### 1. Put the code on GitHub
1. Create a free account at **github.com**.
2. Click **+ → New repository**. Name it (e.g. `my-store`), choose **Public** (free Pages hosting; the repo holds no secrets), click **Create repository**.
3. On the empty repo page click **uploading an existing file**.
4. Unzip `store.zip` on your computer, open the `store` folder, select **everything inside it**
   (index.html, admin.html, `.nojekyll`, README.md and the css, js, supabase folders) and drag it into the page.
5. Click **Commit changes**.

### 2. Create the database (Supabase)
1. Sign up at **supabase.com** → **New project**.
2. Name it, set a strong **database password** (save it), pick the region closest to your customers
   (e.g. *Frankfurt* for Egypt/UAE). Wait ~2 minutes.
3. Left menu → **SQL Editor** → **New query**.
4. Open `supabase/schema.sql` from the zip, copy **all** of it, paste, click **Run**.
   You should see "Success. No rows returned".

### 3. Create your admin account
1. Supabase → **Authentication → Users → Add user → Create new user**.
   Enter your email + a strong password, tick **Auto Confirm User**, create.
2. **SQL Editor → New query**, paste this (with YOUR email) and **Run**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
3. **Authentication → Sign In / Providers** (may be under *Settings*): turn **OFF** "Allow new users to sign up".
   (Even if left on, strangers get no admin power — only accounts in the `admins` table do.)

### 4. Connect the website to the database
1. Supabase → **Project Settings → API** (or **API Keys**). Copy:
   - **Project URL**
   - **anon public** key (or **publishable** key) — **never** the `service_role` / secret key.
2. On GitHub, open `js/config.js` → click the **pencil ✏️** icon → paste both values between the quotes → **Commit changes**.

### 5. Host it (GitHub Pages)
1. Repo → **Settings → Pages**. Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)** → **Save**.
2. In ~1 minute the site is live at `https://<username>.github.io/<repo>/`.

### 6. Link your Hostinger domain
1. Repo → **Settings → Pages → Custom domain**: enter `www.yourdomain.com` → **Save**.
2. Hostinger **hPanel → Domains → your domain → DNS / Nameservers → DNS records**:
   - **CNAME**: Name `www` → Target `<username>.github.io` (delete any existing `www` record first)
   - **A** records for the bare domain (Name `@`), one each: `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153` (delete any other `@` A records first)
3. Wait for the DNS check to pass in Settings → Pages, then tick **Enforce HTTPS**.

### 7. Fill your store
1. Go to `yourdomain.com/admin`, sign in.
2. **Settings**: upload logo + banner, set store name, currency, delivery fee, colors and all texts.
3. **Categories → Subcategories → Products**: add items with images, prices, and Order / Pre-order / Unavailable mode.
4. Place a test order, then try **Track order** with the right code and with a wrong code.
5. Delete the test order from **Orders**.

---

## Editing later (no IDE needed)
- **Content** (products, prices, images, all texts, colors): use `/admin`. Changes are live instantly.
- **Code**: open your GitHub repo and press the **`.`** key — a full code editor opens in your browser.
  Edit, then **Commit**. GitHub Pages redeploys automatically within a minute.
  (Or click any file → pencil ✏️ for quick edits.)

## Security built in
- **Order lookup needs phone + order code**, both matching. Order codes are random (`K7Q2-M9XA`, ~850 billion
  combinations), never sequential. Wrong attempts are limited to 5 per 15 minutes per connection and per phone.
  The same "not found" message is shown whether or not the phone exists.
- **Customers cannot read the orders table at all.** Orders are created and looked up only through two
  server-side database functions (`place_order`, `lookup_order`).
- **Prices are recalculated on the server** at order time from the database, so editing the cart in
  DevTools can't change what is charged. Hidden/unavailable products are rejected.
- **Admin access is enforced by the database** (Row Level Security) — not just hidden buttons.
  Only accounts listed in the `admins` table can change anything. Auto sign-out after 30 min idle.
- Anti-spam: max 10 orders per hour per connection.
- All displayed text is HTML-escaped (no stored XSS from customer names/addresses into the admin panel).
- Strict Content-Security-Policy (meta tag) and an anti-clickjacking guard.
- CSV export is protected against spreadsheet formula injection.

## Good to know
- **Supabase free projects pause after ~1 week with no activity.** Normal store traffic keeps it awake.
  If it pauses, open the Supabase dashboard and click *Restore*. Upgrade to Supabase Pro (~$25/mo) for
  daily backups and no pausing once the store earns.
- **Arabic store?** In `index.html` change `<html lang="en">` to `<html lang="ar" dir="rtl">`, then
  translate all texts from **Admin → Settings**.
- Phone numbers are stored as digits only. Customers must track with the same number they ordered with.
