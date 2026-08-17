/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "MarrowWidget",
  displayName: "Marrow",
  // A leading dot appends to the app's bundle identifier.
  bundleIdentifier: ".widget",
  // The plugin defaults to 18.0. Marrow's app target is 16.4 and the widget matches it,
  // so a reader on iOS 16 is not silently excluded from the feature.
  deploymentTarget: "16.4",
  // Load bearing despite being empty. The plugin mirrors the app's App Group onto this
  // target from inside `if (entitlementsJson)` in build/with-widget.js, so omitting the
  // key entirely skips both the mirror and the generated.entitlements file. An empty
  // object is truthy, which is all it takes to reach the mirror.
  entitlements: {},
};
