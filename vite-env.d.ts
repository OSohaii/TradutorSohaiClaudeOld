/// <reference types="vite/client" />

/**
 * Build-time constant: the value of `version` from package.json.
 * Injected by Vite's `define` (see vite.config.ts). The convention is
 * that the version follows semver with an `-alpha` / `-beta` prerelease
 * suffix, matching the corresponding git tag (e.g. `v0.1.7-alpha`).
 *
 * Use this to render the running app version in the UI so users can
 * verify which build they're testing.
 */
declare const __APP_VERSION__: string;

