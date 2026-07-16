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

Your credentials are already discovered and filled in below — you don't need to look anything
up. Your App Store Connect API key is at
`~/.appstoreconnect/private_keys/AuthKey_Q3L48UB69U.p8`, and your Apple Team ID is
**68LY82NV2V** (you already have two iOS Distribution certificates on the account from
Drizzle, which EAS can reuse).

**Run this in a real terminal** (Terminal.app or your IDE terminal — this one step needs an
interactive TTY, which is exactly why it wasn't automated for you):

```bash
cd ~/Downloads/marrow
export EXPO_ASC_API_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_Q3L48UB69U.p8
export EXPO_ASC_KEY_ID=Q3L48UB69U
export EXPO_ASC_ISSUER_ID=a5755f2b-00a6-4253-ad6a-6acdf1e6150b
eas build --platform ios --profile production
```

With those environment variables set, EAS authenticates to Apple with the **API key — no 2FA
prompt**. When it offers to **generate a distribution certificate and provisioning profile**,
say **yes**; it reuses your existing cert and creates a profile for `com.pratyushs123.marrow`.
If it ever asks for the Apple Team Type, choose **Individual**, Team ID **68LY82NV2V**.

It then builds on EAS's macOS workers (~10–20 min) and gives you a `.ipa`. The build runs on a
clean cloud path, so the local "spaces in the folder path" issue never applies there.

Watch progress any time with `eas build:list` or the URL it prints.

## Step 3 — Upload to TestFlight

```bash
eas submit --platform ios --latest
```

`--latest` grabs the build from Step 2. With the same three `EXPO_ASC_*` environment variables
still exported, it uploads to App Store Connect non-interactively. If the app record from
Step 1 doesn't exist yet, `eas submit` offers to create it — say yes.

**Once you've kicked off Step 2 and have a finished build, I can run Step 3 for you** — the
submit is non-interactive with the API key already verified. Just tell me the build is ready.

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
