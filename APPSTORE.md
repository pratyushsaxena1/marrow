# Shipping Marrow to the App Store

Marrow is live. This is the runbook for shipping an **update** to the public App Store.
`TESTFLIGHT.md` covers getting a build to testers; this file covers getting one to everyone.

App Store Connect app: **marrow - scroll to learn**, Apple ID `6791669414`,
bundle `com.pratyushs123.marrow`.

## Release history

| Version | Build | State | Notes |
| --- | --- | --- | --- |
| 1.0 | 8 | `READY_FOR_SALE` | Shipped 2026-07-26 after two Guideline 4.2 rejections. |
| 1.1 | 9 | `WAITING_FOR_REVIEW` | Submitted 2026-08-14. UI rework, redrawn icon, captioned screenshots. |

## Settings that persist across versions

These are set on the app, not the version, and carry forward automatically. You should not
need to touch them again:

- **App Privacy** label: "Data Not Collected" (published in the web UI; Apple exposes no API
  for the nutrition label, so if it ever needs changing, it is a manual step).
- **Content rights**: does not use third-party content.
- **Category**: Primary = Education, Secondary = Reference.
- **Age rating**: 4+.
- **Subtitle**: "Learn one idea at a time".
- **Privacy URL**: https://pratyushsaxena1.github.io/marrow/privacy.html
- **Support URL**: https://pratyushsaxena1.github.io/marrow/support.html
- **Export compliance**: handled in `app.json` (`ITSAppUsesNonExemptEncryption: false`), so
  no encryption docs are ever requested.
- **Pricing and availability**: free, all territories.

When you create a new version, App Store Connect copies the description, keywords, support
URL, **and the previous version's screenshots** onto it. The screenshots are the one thing
you usually have to replace.

## Shipping an update

1. **Bump `expo.version`** in `app.json`. It must differ from every released version.
   Leave `ios.buildNumber` alone: the `production` EAS profile has `autoIncrement`, so
   `eas build` bumps it and writes it back to `app.json`.
2. **Build**: `eas build --platform ios --profile production`. Takes roughly 20 minutes.
   A native module change (adding `expo-haptics`, for example) *requires* this. An OTA
   update will not carry native code.
3. **Upload**: `eas submit --platform ios --profile production --latest`. Then wait about
   5 to 10 minutes for Apple to process the binary to `processingState: VALID`. You cannot
   attach it before then.
4. **Create the version** and set the listing over the ASC API (see "API notes" below):
   create the `appStoreVersion`, set `whatsNew`, replace the screenshots, attach the build.
5. **Submit**: create a `reviewSubmission`, add a `reviewSubmissionItem` pointing at the
   version, then PATCH the submission `{"submitted": true}`. Review usually takes 24 to 48h.

## Regenerating the store screenshots

Required whenever the UI changes, since the shots must show the current app. The current set
lives in `store/screenshots/`: 5 iPhone 6.9" (1320x2868) and 5 iPad 13" (2064x2752), each an
SF Pro caption over a real screen that bleeds off the bottom edge.

1. Boot an iPhone 17 Pro Max and an iPad Pro 13", and install a Release build on each.
2. Launch once so the database exists, then seed it with a month of review history, or the
   Progress screen photographs empty. Seeding writes `review_log`, `card_state` and
   `bookmarks` rows directly into `Documents/SQLite/marrow.db` in the app's data container.
3. `xcrun simctl status_bar <udid> override --time "9:41" --batteryState discharging
   --batteryLevel 100 --wifiBars 3` for a clean status bar.
4. Capture five raw screens per device into a folder as `01.png` through `05.png`, in the
   order of `CAPTIONS` in `scripts/make-screenshots.py`.
5. `python3 scripts/make-screenshots.py <raw-dir> <out-dir> --device iphone|ipad`.

## The app icon

The icon is **not** a listing upload. Apple reads it out of the binary's asset catalog, so a
new icon only reaches the store as part of a new build.

`scripts/make-icons.py` renders every asset from one description of the mark, including the
iOS dark and tinted variants. Rerun it after any palette change.

## API notes

The ASC API key is at `~/.appstoreconnect/private_keys/AuthKey_Q3L48UB69U.p8`
(Key ID `Q3L48UB69U`, Issuer `a5755f2b-00a6-4253-ad6a-6acdf1e6150b`, Team `68LY82NV2V`).

- Screenshot upload is three steps per image: POST `appScreenshots` to reserve it, PUT the
  bytes to each returned `uploadOperation`, then PATCH `{"uploaded": true,
  "sourceFileChecksum": "<md5>"}`. Pin display order afterwards by PATCHing the set's
  `relationships/appScreenshots` with the ids in the order you want.
- Deleting the copied-forward screenshots before uploading replacements is safe while the
  version is in `PREPARE_FOR_SUBMISSION`.

## Standing risks for a public release

- **Card accuracy.** The 270 cards were written from model knowledge. Every source URL now
  resolves (`npm run check-links` is part of the content workflow), but a URL resolving is not
  the same as the claim matching what is on the page. Finance is the highest-risk domain. Your
  name is on these claims publicly, so a human accuracy pass is still worth doing.
- **Guideline 4.2.** Both 1.0 rejections came from an iPad. Any future version that thins out
  what there is to *do* in the app risks the same finding. Test on an iPad before submitting.
