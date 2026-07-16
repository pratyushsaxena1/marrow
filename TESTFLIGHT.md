# Shipping Marrow to TestFlight

Everything in this repo is configured for TestFlight. What remains needs **your Apple
credentials**, which is why it can't be automated for you — Apple requires an interactive
login (2FA) or a key that only you can generate. This is the runbook.

## Where things stand

- ✅ App builds and runs (verified on an iOS 26 simulator, release build).
- ✅ EAS project linked: `@pratyushs123/marrow`.
- ✅ Bundle id `com.pratyushs123.marrow`, display name **Marrow**, version 1.0.0, build 1.
- ✅ `eas.json` has a `production` profile that produces a store-signed `.ipa`.
- ⬜ Apple Developer account, credentials, App Store Connect record, build, upload — below.

## Prerequisite

An **active paid Apple Developer Program membership** ($99/yr) on your Apple ID. A free
Apple ID cannot ship to TestFlight. Check at https://developer.apple.com/account — if it
says "Enrolled", you're set.

---

## Recommended path: App Store Connect API key

An API key lets `eas build` and `eas submit` run without repeated 2FA prompts, and is the
least painful option. Generate it once:

1. Go to https://appstoreconnect.apple.com → **Users and Access** → **Integrations** tab →
   **App Store Connect API** (under Keys).
2. Click **+**, name it (e.g. "EAS"), role **App Manager**, **Generate**.
3. **Download the `.p8` file** — you only get this download once. Note the **Key ID** and,
   at the top of the page, the **Issuer ID**.

Keep the `.p8` somewhere safe and out of git (it's a credential). You'll hand it to EAS in
the steps below.

---

## Step 1 — Create the app record in App Store Connect

1. https://appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Platform **iOS**; Name **Marrow** (must be unique across the App Store — if taken, try
   "Marrow — Learn by Scrolling" or similar; the display name on the phone stays "Marrow");
   Primary language **English (U.S.)**; Bundle ID **com.pratyushs123.marrow** (if it's not
   in the dropdown yet, Step 2's build registers it — you can create the record after the
   first build instead); SKU any string, e.g. `marrow-001`.
3. Create. You don't need to fill in screenshots or descriptions for TestFlight internal
   testing — those are only required for public App Store review later.

## Step 2 — Build the signed app (cloud)

From `/Users/pratyush/Downloads/marrow`:

```bash
eas build --platform ios --profile production
```

The first run asks how to handle credentials:
- Choose to log in with your **App Store Connect API key** (point it at the `.p8`, Key ID,
  Issuer ID from above) — or log in with your Apple ID and 2FA.
- Let EAS **generate the distribution certificate and provisioning profile** for you (say
  yes to its prompts). It stores them for next time.

It then builds on EAS's macOS workers (~10–20 min) and gives you a `.ipa` URL. Because the
build runs on a clean cloud path, the local "spaces in the folder path" issue does not apply
there — but keep working from `~/Downloads/marrow` locally regardless.

## Step 3 — Upload to TestFlight

```bash
eas submit --platform ios --latest
```

`--latest` grabs the build from Step 2. Give it the same API key when asked. It uploads to
App Store Connect. If the app record from Step 1 doesn't exist yet, `eas submit` offers to
create it — that's fine.

## Step 4 — Install on your phone

1. Apple emails you (and shows in App Store Connect → your app → **TestFlight**) that the
   build is "Processing." That takes ~5–30 min.
2. Under **TestFlight → Internal Testing**, add yourself as an internal tester (your Apple
   ID). Internal testing needs **no App Review** — it's available as soon as processing ends.
3. Install **TestFlight** from the App Store on your iPhone, sign in with the same Apple ID,
   and Marrow appears. Install it and scroll.

---

## If you'd rather I run Steps 2–3 for you

I can, *if* you generate the App Store Connect API key (the `.p8`, Key ID, Issuer ID) and
tell me where the file is. With that, `eas build` and `eas submit` run without interactive
2FA. Handing over an API key is a real credential decision, though — an App Manager key can
manage your app records and uploads. If you'd rather not, run Steps 2–4 yourself; they're
copy-paste and the prompts are self-explanatory.

Either way, **Step 1 and adding yourself as a tester in Step 4 are things only you can do**
from your Apple account.

---

## Before a *public* App Store release (not needed for TestFlight-to-self)

These are the open items from the build, carried forward — none block TestFlight, all block
a public launch:

- **Link-check all 150 card source URLs.** They were written from model knowledge without
  fetching, so they're plausible but unverified. Your name goes on these claims publicly.
- **Human accuracy pass on the finance cards.** The highest-risk domain; several were
  self-flagged as touching contested ground. See the build notes.
- **Actually use it for a week first.** This was the whole plan: v1 is an instrument to learn
  what the real product should be. Apple's Guideline 4.2 (minimum functionality) is also a
  real rejection risk for a 150-card text reader with no onboarding — worth expanding first.
- **App Store listing:** screenshots, description, privacy policy URL, age rating, category.
