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
- ✅ **Privacy & support pages** authored at `docs/privacy.html` and `docs/support.html`.

All pushed text lives on the **draft** — nothing is public, and you can edit any of it in
App Store Connect before submitting. Review the description/keywords and change anything you
don't like.

---

## Your steps (only you can do these)

### 1. Host the privacy policy and support pages, get two URLs
Apple requires a **privacy policy URL** and a **support URL**, both live and public.
I wrote both pages into `docs/`. Easiest host is GitHub Pages on your existing repo:

1. Edit `docs/privacy.html` and `docs/support.html` — replace `you@example.com` with a real
   contact address (search for the `TODO(you)` comments).
2. Commit and push `docs/`.
3. On GitHub: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/docs`, Save.
4. After it publishes, your URLs will be:
   - Privacy: `https://pratyushsaxena1.github.io/marrow/privacy.html`
   - Support: `https://pratyushsaxena1.github.io/marrow/support.html`
5. In App Store Connect: put the **privacy policy URL** under App → App Information →
   Privacy Policy, and the **support URL** on the 1.0 version page.

### 2. App Privacy questionnaire (App → App Privacy)
Marrow collects nothing and makes no network requests — verified in the code (local SQLite
only, no analytics/ads/tracking). Answer:
- "Do you or your third-party partners collect data from this app?" → **No**.
- Then **Publish**. That produces a "Data Not Collected" privacy label.

(I did not push this via the API on purpose — it's your legal declaration, and it's one click.)

### 3. Age rating (App → App Information, or on the version page)
Answer **None / No** to every content question. That yields a **4+** rating, which is
correct for an educational text app. Save.

### 4. Screenshots — already done
Real screenshots are uploaded to the draft (5 iPhone 6.9" + 3 iPad 13"). Nothing required
here unless you want to replace them with polished/captioned marketing versions.

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
