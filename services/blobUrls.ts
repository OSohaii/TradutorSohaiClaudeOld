// Lifecycle helpers for `URL.createObjectURL` blobs.
//
// Pre-PR #6 (Phase 3a) the codebase called `URL.createObjectURL` in two
// places (App.tsx upload + base64-to-blob helper) and **never** revoked
// the resulting URLs. Every uploaded file, every Torii-rendered page,
// and every cleaner mask leaked one entry in the browser's blob URL
// table for the lifetime of the tab. Loading a couple of full chapters
// exhausted memory.
//
// This module centralises the contract: callers always go through
// `createTrackedObjectURL` to mint a blob URL, and the session store
// (or any other lifecycle owner) calls `revokeIfBlob` when the URL is
// no longer referenced. URLs we did not mint (data: URLs from the
// library, regular http(s) URLs from the user) are silently ignored,
// so callers can call `revokeIfBlob` defensively without sniffing the
// scheme themselves.

/**
 * Wrapper around `URL.createObjectURL` so call sites are easy to grep
 * and so we always know that any `blob:` URL in the app was minted
 * here.
 */
export const createTrackedObjectURL = (blob: Blob): string =>
  URL.createObjectURL(blob);

/**
 * Revokes `url` only if it is a `blob:` URL. Safe to call with empty
 * strings, undefined, or `data:` / `http(s):` URLs (no-op).
 */
export const revokeIfBlob = (url: string | undefined | null): void => {
  if (!url) return;
  if (typeof url !== 'string') return;
  if (!url.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // revokeObjectURL never throws in practice, but stay defensive so
    // a bad URL doesn't take the caller's mutation down with it.
  }
};

/**
 * Convenience helper that revokes every `blob:` URL referenced by a
 * processed image (the original upload, any cleaner / Torii output,
 * and the inpaint mask). Used by the session store when an image is
 * removed or replaced.
 */
export const revokeImageUrls = (image: {
  imageUrl?: string;
  translatedImageUrl?: string;
  maskDataUrl?: string;
}): void => {
  revokeIfBlob(image.imageUrl);
  revokeIfBlob(image.translatedImageUrl);
  revokeIfBlob(image.maskDataUrl);
};
