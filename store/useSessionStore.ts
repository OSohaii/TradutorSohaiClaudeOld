import { create } from 'zustand';
import { ProcessedImage, TextBubble } from '../types';
import { revokeIfBlob, revokeImageUrls } from '../services/blobUrls';

/**
 * Per-tab session state: which images are loaded, which one is being
 * viewed, and convenience helpers to mutate them. Intentionally NOT
 * persisted: closing the tab clears the queue. The library (in
 * `useLibraryStore`) is the durable storage.
 *
 * Pre-Phase-2b this lived as `useState` pairs in App.tsx, with mutation
 * logic spread across `processImage`, `handleRetranslate`, `handleFilesSelect`,
 * `updateImageState`, `handleBubbleUpdate`, etc. Centralising it here
 * lets the viewer and any future hook subscribe directly without prop
 * drilling.
 *
 * Blob-URL lifecycle (B17, fixed in PR #6):
 * Every mutation that drops a `ProcessedImage` reference (or overwrites
 * one of its URL fields) revokes the associated `blob:` URLs via the
 * `services/blobUrls` helper. Data URLs and HTTP(S) URLs are left
 * alone, so library pages (which come back as base64 from IndexedDB)
 * are unaffected.
 *
 * Bubble undo/redo (B8/B9, fixed in PR #8):
 * Per-image history of the full `bubbles` array, capped at 30
 * snapshots. `pushBubbleSnapshot` is called BEFORE a mutation
 * (matching the prior `saveToHistory` contract from MangaViewer);
 * `undoBubbles`/`redoBubbles` rewind/forward by replacing the whole
 * array, so add/delete/update are all reversible (the prior approach
 * snapshotted only the bubbles array but reapplied via per-bubble
 * `onBubbleUpdate`, which silently ignored adds and deletes).
 */
const MAX_BUBBLE_SNAPSHOTS = 30;

export interface BubbleHistoryEntry {
  /** Stack of past bubble arrays; index 0 = oldest. */
  snapshots: TextBubble[][];
  /**
   * Cursor: `snapshots[index]` is the current "before" state. Mutations
   * push a new entry to the end and bump `index` to the new top; undo
   * decrements; redo increments.
   */
  index: number;
}

export interface SessionState {
  /** The image currently displayed in the viewer. */
  currentImage: ProcessedImage | null;
  /** Newest-first list of images opened in this tab. */
  history: ProcessedImage[];
  /** Per-image bubble undo/redo stack, keyed by image id. */
  bubbleHistory: Record<string, BubbleHistoryEntry>;

  // ---- Direct setters ----
  setCurrentImage: (img: ProcessedImage | null) => void;
  setHistory: (history: ProcessedImage[]) => void;

  // ---- Higher-level mutations ----
  /**
   * Prepends new images to the history and focuses the first new one.
   * Mirrors the original App.tsx behavior on file upload.
   */
  addImages: (newImages: ProcessedImage[]) => void;
  /** Removes one image from history; refocuses the next one if it was current. */
  removeImage: (id: string) => void;
  /** Wipes everything, e.g. when loading a chapter from the library. */
  clearHistory: () => void;
  /**
   * Replaces the entire history (and focuses the first entry). Used when
   * the user opens a saved chapter from the library.
   */
  replaceHistory: (images: ProcessedImage[]) => void;

  /**
   * Merges `partial` into both `history[match]` and `currentImage` if
   * the IDs match. Single source of truth for "update one image".
   */
  updateImageState: (id: string, partial: Partial<ProcessedImage>) => void;

  // ---- Bubble helpers (target the current image) ----
  updateBubble: (bubble: TextBubble) => void;
  removeBubble: (bubbleId: string) => void;
  addBubble: (bubble: TextBubble) => void;
  /** Like updateBubble but targets a specific image by ID (for strip mode). */
  updateBubbleForImage: (imageId: string, bubble: TextBubble) => void;

  // ---- Bubble undo/redo (B8/B9) ----
  /**
   * Captures the current image's bubbles into the undo stack. Call
   * BEFORE applying a mutation. Truncates anything in the redo branch
   * (when the user undid then made a new change, redo is invalidated).
   */
  pushBubbleSnapshot: () => void;
  /**
   * Like pushBubbleSnapshot but targets a specific image by ID (for strip mode).
   */
  pushBubbleSnapshotForImage: (imageId: string) => void;
  /**
   * Walks history one step back. Replaces `image.bubbles` with the
   * previous snapshot. Returns true if the cursor moved.
   */
  undoBubbles: () => boolean;
  /**
   * Walks history one step forward. Returns true if the cursor moved.
   */
  redoBubbles: () => boolean;
}

/**
 * Drops history entry for `imageId` (if any). Used when the image
 * goes away (removed from the session, or the session is cleared).
 */
const dropHistory = (
  history: Record<string, BubbleHistoryEntry>,
  imageId: string,
): Record<string, BubbleHistoryEntry> => {
  if (!history[imageId]) return history;
  const next = { ...history };
  delete next[imageId];
  return next;
};

export const useSessionStore = create<SessionState>()((set, get) => ({
  currentImage: null,
  history: [],
  bubbleHistory: {},

  setCurrentImage: img => set({ currentImage: img }),

  // Replacing history wholesale: revoke any blob URLs we owned in the
  // outgoing list that aren't carried over to the new one (matched by
  // identity, since the same ProcessedImage object can be present in
  // both lists during a no-op set).
  setHistory: history =>
    set(state => {
      const surviving = new Set(history);
      let nextBubbleHistory = state.bubbleHistory;
      state.history.forEach(img => {
        if (!surviving.has(img)) {
          revokeImageUrls(img);
          nextBubbleHistory = dropHistory(nextBubbleHistory, img.id);
        }
      });
      return { history, bubbleHistory: nextBubbleHistory };
    }),

  addImages: newImages =>
    set(state => ({
      history: [...newImages, ...state.history],
      // Original code unconditionally focused the first new image; keep
      // that contract so callers don't have to think about it.
      currentImage: newImages[0] ?? state.currentImage,
    })),

  removeImage: id =>
    set(state => {
      const removed = state.history.find(h => h.id === id);
      if (removed) revokeImageUrls(removed);
      const newHistory = state.history.filter(h => h.id !== id);
      const wasCurrent = state.currentImage?.id === id;
      return {
        history: newHistory,
        currentImage: wasCurrent ? newHistory[0] ?? null : state.currentImage,
        bubbleHistory: dropHistory(state.bubbleHistory, id),
      };
    }),

  clearHistory: () =>
    set(state => {
      state.history.forEach(revokeImageUrls);
      return { history: [], currentImage: null, bubbleHistory: {} };
    }),

  replaceHistory: images =>
    set(state => {
      const surviving = new Set(images);
      let nextBubbleHistory = state.bubbleHistory;
      state.history.forEach(img => {
        if (!surviving.has(img)) {
          revokeImageUrls(img);
          nextBubbleHistory = dropHistory(nextBubbleHistory, img.id);
        }
      });
      return {
        history: images,
        currentImage: images[0] ?? null,
        bubbleHistory: nextBubbleHistory,
      };
    }),

  updateImageState: (id, partial) =>
    set(state => {
      const existing =
        state.currentImage?.id === id
          ? state.currentImage
          : state.history.find(h => h.id === id);

      if (existing) {
        // Revoke any previously-held blob URL whose slot is being
        // overwritten with a different URL (or cleared). Skips when
        // `partial` does not touch the field, or when the value is
        // unchanged (re-setting the same URL keeps it valid).
        if ('imageUrl' in partial && partial.imageUrl !== existing.imageUrl) {
          revokeIfBlob(existing.imageUrl);
        }
        if (
          'translatedImageUrl' in partial &&
          partial.translatedImageUrl !== existing.translatedImageUrl
        ) {
          revokeIfBlob(existing.translatedImageUrl);
        }
        if (
          'maskDataUrl' in partial &&
          partial.maskDataUrl !== existing.maskDataUrl
        ) {
          revokeIfBlob(existing.maskDataUrl);
        }
      }

      // If the bubbles array is being wholesale replaced (e.g.
      // pipeline finished, retranslate cleared them), we drop the
      // undo history for that image — the prior snapshots no longer
      // apply to the new content.
      const droppingBubbleHistory =
        'bubbles' in partial && partial.bubbles !== existing?.bubbles;

      return {
        history: state.history.map(img =>
          img.id === id ? { ...img, ...partial } : img,
        ),
        currentImage:
          state.currentImage?.id === id
            ? { ...state.currentImage, ...partial }
            : state.currentImage,
        bubbleHistory: droppingBubbleHistory
          ? dropHistory(state.bubbleHistory, id)
          : state.bubbleHistory,
      };
    }),

  updateBubble: bubble => {
    const cur = get().currentImage;
    if (!cur) return;
    // Apply the mutation directly without dropping history (this is
    // the "edit" path; the per-image history is preserved). Note that
    // updateImageState only drops the history when the bubbles array
    // identity changes via the `partial.bubbles !== existing.bubbles`
    // check; passing a new map is exactly that, so we set bubbles
    // explicitly and rely on the caller to call `pushBubbleSnapshot`
    // first.
    const newBubbles = cur.bubbles.map(b => (b.id === bubble.id ? bubble : b));
    set(state => ({
      history: state.history.map(img =>
        img.id === cur.id ? { ...img, bubbles: newBubbles } : img,
      ),
      currentImage:
        state.currentImage?.id === cur.id
          ? { ...state.currentImage, bubbles: newBubbles }
          : state.currentImage,
    }));
  },

  updateBubbleForImage: (imageId, bubble) => {
    const target = get().history.find(h => h.id === imageId);
    if (!target) return;
    const newBubbles = target.bubbles.map(b => (b.id === bubble.id ? bubble : b));
    set(state => ({
      history: state.history.map(img =>
        img.id === imageId ? { ...img, bubbles: newBubbles } : img,
      ),
      currentImage:
        state.currentImage?.id === imageId
          ? { ...state.currentImage, bubbles: newBubbles }
          : state.currentImage,
    }));
  },

  removeBubble: bubbleId => {
    const cur = get().currentImage;
    if (!cur) return;
    const newBubbles = cur.bubbles.filter(b => b.id !== bubbleId);
    set(state => ({
      history: state.history.map(img =>
        img.id === cur.id ? { ...img, bubbles: newBubbles } : img,
      ),
      currentImage:
        state.currentImage?.id === cur.id
          ? { ...state.currentImage, bubbles: newBubbles }
          : state.currentImage,
    }));
  },

  addBubble: bubble => {
    const cur = get().currentImage;
    if (!cur) return;
    const newBubbles = [...cur.bubbles, bubble];
    set(state => ({
      history: state.history.map(img =>
        img.id === cur.id ? { ...img, bubbles: newBubbles } : img,
      ),
      currentImage:
        state.currentImage?.id === cur.id
          ? { ...state.currentImage, bubbles: newBubbles }
          : state.currentImage,
    }));
  },

  pushBubbleSnapshot: () => {
    const cur = get().currentImage;
    if (!cur) return;
    set(state => {
      const existing = state.bubbleHistory[cur.id];
      // Truncate anything past the cursor (redo branch invalidated).
      const head = existing
        ? existing.snapshots.slice(0, existing.index + 1)
        : [];
      // Snapshot is a shallow clone of the array (bubble objects are
      // already replaced by reference on every mutation, so this is
      // enough for structural sharing).
      const next = [...head, [...cur.bubbles]];
      // Cap memory: drop oldest entries when over the limit.
      const trimmed = next.length > MAX_BUBBLE_SNAPSHOTS
        ? next.slice(next.length - MAX_BUBBLE_SNAPSHOTS)
        : next;
      return {
        bubbleHistory: {
          ...state.bubbleHistory,
          [cur.id]: { snapshots: trimmed, index: trimmed.length - 1 },
        },
      };
    });
  },

  pushBubbleSnapshotForImage: (imageId) => {
    const target = get().history.find(h => h.id === imageId);
    if (!target) return;
    set(state => {
      const existing = state.bubbleHistory[imageId];
      const head = existing
        ? existing.snapshots.slice(0, existing.index + 1)
        : [];
      const next = [...head, [...target.bubbles]];
      const trimmed = next.length > MAX_BUBBLE_SNAPSHOTS
        ? next.slice(next.length - MAX_BUBBLE_SNAPSHOTS)
        : next;
      return {
        bubbleHistory: {
          ...state.bubbleHistory,
          [imageId]: { snapshots: trimmed, index: trimmed.length - 1 },
        },
      };
    });
  },

  undoBubbles: () => {
    const state = get();
    const cur = state.currentImage;
    if (!cur) return false;
    const entry = state.bubbleHistory[cur.id];
    if (!entry || entry.index <= 0) return false;
    const prevIndex = entry.index - 1;
    const prevBubbles = entry.snapshots[prevIndex];
    set(s => ({
      history: s.history.map(img =>
        img.id === cur.id ? { ...img, bubbles: [...prevBubbles] } : img,
      ),
      currentImage:
        s.currentImage?.id === cur.id
          ? { ...s.currentImage, bubbles: [...prevBubbles] }
          : s.currentImage,
      bubbleHistory: {
        ...s.bubbleHistory,
        [cur.id]: { ...entry, index: prevIndex },
      },
    }));
    return true;
  },

  redoBubbles: () => {
    const state = get();
    const cur = state.currentImage;
    if (!cur) return false;
    const entry = state.bubbleHistory[cur.id];
    if (!entry || entry.index >= entry.snapshots.length - 1) return false;
    const nextIndex = entry.index + 1;
    const nextBubbles = entry.snapshots[nextIndex];
    set(s => ({
      history: s.history.map(img =>
        img.id === cur.id ? { ...img, bubbles: [...nextBubbles] } : img,
      ),
      currentImage:
        s.currentImage?.id === cur.id
          ? { ...s.currentImage, bubbles: [...nextBubbles] }
          : s.currentImage,
      bubbleHistory: {
        ...s.bubbleHistory,
        [cur.id]: { ...entry, index: nextIndex },
      },
    }));
    return true;
  },
}));
