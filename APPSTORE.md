# Shipping Marrow to the public App Store

This is the runbook for going from "on TestFlight" to "live on the App Store." It picks up
where `TESTFLIGHT.md` left off. The mechanical prep that can be done with the App Store
Connect API key has already been done for you (see "Done" below). What remains needs either
your Apple login, a hosting decision, or a judgment call that should be yours — listed under
"Your steps."

App Store Connect app: **marrow - scroll to learn** — Apple ID `6791669414`,
bundle `com.pratyushs123.marrow`. Draft version **1.0** is in `PREPARE_FOR_SUBMISSION`.

---

## Done for you (via the ASC API)

- ✅ **Build 4 attached** to version 1.0 (uploaded, processing = VALID).
- ✅ **Content rights** declared (does not use third-party content).
- ✅ **Description, keywords, promotional text** written and pushed to the draft.
- ✅ **Subtitle**: "Learn one idea at a time".
- ✅ **Category**: Primary = Education, Secondary = Reference.
- ✅ **Export compliance** already handled in `app.json`
  (`ITSAppUsesNonExemptEncryption: false`) — no encryption docs needed.
- ✅ **Screenshots uploaded**: 5 iPhone 6.9" + 3 iPad 13" (real app screens, captured on
  simulator, all processed with no errors). Review them and swap in polished/captioned
  versions later if you want. Note: the iPad shots have a faint gray arc in the bottom-right
  corner (a harmless simulator overlay) — cosmetic only; retake from a real iPad if it bugs you.
- ✅ **Privacy & support pages** authored, hosted on GitHub Pages, and wired into the listing:
  - Privacy: https://pratyushsaxena1.github.io/marrow/privacy.html
  - Support: https://pratyushsaxena1.github.io/marrow/support.html
- ✅ **Age rating** set to **4+** (all content questions = None/No).
- ✅ **Pricing** is configured on the app.

All pushed text lives on the **draft** — nothing is public, and you can edit any of it in
App Store Connect before submitting. Review the description/keywords and change anything you
don't like.

---

## Your steps (only you can do these) — this is all that's left

### 1. App Privacy questionnaire (App → App Privacy)  ← the one required data-entry step
This is the **only** listing field I could not set: Apple exposes **no API** for the privacy
"nutrition label," so it must be done in the App Store Connect web UI. It takes ~1 minute.
Marrow collects nothing and makes no network requests — verified in the code (local SQLite
only, no analytics/ads/tracking). So:
- Click **Get Started**, then answer "Do you or your third-party partners collect data from
  this app?" → **No**.
- Click **Publish**. That produces a "Data Not Collected" privacy label.

### 2. (Glance) Confirm availability/territories
Pricing is set, but double-check **Pricing and Availability** lists the territories you want
(default is all). No action needed unless you want to restrict it.

### 3. Submit for Review
On the **1.0** version page, click **Add for Review → Submit for Review**, and pick your
release option (automatic on approval, or manual). This is the one irreversible outward step.
Apple review typically takes ~24–48h.

Everything else (build, description, keywords, subtitle, category, content rights, export
compliance, screenshots, privacy/support URLs, age rating) is already done on the draft.

### 5. Review the flagged risks before you submit (your call)
These are carried over from the build notes and are real for a *public* release (they did
not matter for TestFlight-to-yourself):
- **Card accuracy.** The 230 cards were written from model knowledge; the source URLs were
  not all link-checked, and the finance domain is the highest-risk. Your name is on these
  claims publicly. Consider a human accuracy pass, especially on finance.
- **Guideline 4.2 (minimum functionality).** A text-card reader with no onboarding is a
  known rejection risk. Worth confirming you're comfortable, and having a reviewer note
  ready that explains the spaced-repetition mechanic.

### 6. Submit for review
Once 1–5 are green, the version page will show **Add for Review → Submit**. Pick your
release option (automatic on approval, or manual). This is the one irreversible, outward
step — that's why it's left to you. Apple review typically takes ~24–48h.

---

## Quick reference

- Rebuild + re-upload a binary (if you change code): `eas build -p ios --profile production`
  then `eas submit -p ios --latest`, with the `EXPO_ASC_*` env vars from `TESTFLIGHT.md`.
- Bump `ios.buildNumber` in `app.json` for every new upload.
