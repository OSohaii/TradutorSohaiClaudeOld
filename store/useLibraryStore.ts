import { create } from 'zustand';
import { LibraryState, Manga, Chapter } from '../types/library';
import { ProcessedImage } from '../types';
import {
  loadLibrary,
  saveLibrary,
  addManga as addMangaPure,
  updateManga as updateMangaPure,
  deleteManga as deleteMangaPure,
  addChapter as addChapterPure,
  updateChapter as updateChapterPure,
  deleteChapter as deleteChapterPure,
  addPagesToChapter as addPagesToChapterPure,
  getMangaById,
  getChapterById,
  migrateLegacyImagesToIDB,
} from '../services/libraryService';
import { deleteImages } from '../services/imageStorage';

/**
 * Wraps the library `LibraryState` (mangas + selection cursors) and
 * mirrors `libraryService` mutations so any subscriber gets the same
 * snapshot. Pre-Phase-2b, the state lived inside `LibraryManager` via
 * `useState(loadLibrary)`, which meant App.tsx couldn't observe library
 * changes (e.g. the user creating a new manga in the modal didn't
 * propagate anywhere). With this store every component that needs the
 * library subscribes to the same source.
 *
 * Persistence model: we DO NOT use the zustand `persist` middleware
 * here because `libraryService` already implements the
 * localStorage-for-metadata + IndexedDB-for-images split it inherits
 * from earlier code. Instead, every action calls the matching pure
 * function from `libraryService` and persists the result via
 * `saveLibrary()`. This keeps the IDB migration helpers
 * (`migrateLegacyImagesToIDB`) working without re-implementing them
 * at the store layer.
 */
export interface LibraryStoreState extends LibraryState {
  // ---- Mutations ----
  addManga: (manga: Manga) => void;
  updateManga: (mangaId: string, updates: Partial<Manga>) => void;
  deleteManga: (mangaId: string) => void;

  addChapter: (mangaId: string, chapter: Chapter) => void;
  updateChapter: (
    mangaId: string,
    chapterId: string,
    updates: Partial<Chapter>,
  ) => void;
  deleteChapter: (mangaId: string, chapterId: string) => void;

  /**
   * Persists the given session images as pages of `chapterId` (writes
   * the originals to IndexedDB via `libraryService`). Async because the
   * page conversion creates thumbnails and base64 versions of the
   * images.
   */
  addPagesToChapter: (
    mangaId: string,
    chapterId: string,
    images: ProcessedImage[],
  ) => Promise<void>;

  // ---- Selection cursors (UI helpers) ----
  setCurrentMangaId: (id: string | null) => void;
  setCurrentChapterId: (id: string | null) => void;

  // ---- One-shot maintenance ----
  /**
   * Runs `migrateLegacyImagesToIDB` against the current state and
   * commits the result. Idempotent — see the helper for details.
   * Call this once at app boot (App.tsx mount).
   */
  runLegacyImagesMigration: () => Promise<void>;
}

/**
 * Hydrate from `libraryService.loadLibrary()` synchronously at module
 * import time so the first React render already sees the persisted
 * mangas instead of an empty array. `loadLibrary` is now a pure read
 * (B12 fixed in PR #6). The legacy localStorage→IndexedDB migration is
 * triggered explicitly via `runLegacyImagesMigration()` from App.tsx.
 */
const initialState: LibraryState =
  typeof window === 'undefined'
    ? { mangas: [], currentMangaId: null, currentChapterId: null }
    : loadLibrary();

/**
 * Collects every `pageId` belonging to a manga. Used to clean up
 * IndexedDB when the manga (or one of its chapters) is deleted (A6).
 */
const collectMangaPageIds = (manga: Manga | undefined): string[] => {
  if (!manga) return [];
  return manga.chapters.flatMap(c => c.pages.map(p => p.id));
};

const collectChapterPageIds = (chapter: Chapter | undefined): string[] =>
  chapter ? chapter.pages.map(p => p.id) : [];

/**
 * Fire-and-forget IDB cleanup. We do not block the UI on it: the user
 * has already seen the manga/chapter disappear, and a stranded blob in
 * IndexedDB is a soft failure (covered by the next manual cleanup or
 * `clearAllImages`). Errors land in the console for debugging.
 */
const cleanupOrphanImages = (pageIds: string[]): void => {
  if (pageIds.length === 0) return;
  void deleteImages(pageIds).catch(err => {
    console.error('Erro ao limpar imagens órfãs do IndexedDB:', err);
  });
};

export const useLibraryStore = create<LibraryStoreState>()((set, get) => ({
  ...initialState,

  addManga: manga => {
    const next = addMangaPure(get(), manga);
    set(next);
    saveLibrary(next);
  },

  updateManga: (mangaId, updates) => {
    const next = updateMangaPure(get(), mangaId, updates);
    set(next);
    saveLibrary(next);
  },

  deleteManga: mangaId => {
    const current = get();
    // Snapshot orphan IDs BEFORE applying the mutation. After the
    // delete the manga is gone from state and we can no longer find
    // its pages.
    const orphanPageIds = collectMangaPageIds(getMangaById(current, mangaId));

    const next = deleteMangaPure(current, mangaId);
    set(next);
    saveLibrary(next);

    // A6: drop the matching IndexedDB entries so deleting a manga
    // actually frees the disk it occupied. Errors are non-fatal (see
    // helper).
    cleanupOrphanImages(orphanPageIds);
  },

  addChapter: (mangaId, chapter) => {
    const next = addChapterPure(get(), mangaId, chapter);
    set(next);
    saveLibrary(next);
  },

  updateChapter: (mangaId, chapterId, updates) => {
    const next = updateChapterPure(get(), mangaId, chapterId, updates);
    set(next);
    saveLibrary(next);
  },

  deleteChapter: (mangaId, chapterId) => {
    const current = get();
    const orphanPageIds = collectChapterPageIds(
      getChapterById(current, mangaId, chapterId),
    );

    const next = deleteChapterPure(current, mangaId, chapterId);
    set(next);
    saveLibrary(next);

    // A6: same as `deleteManga` — purge the IDB entries the chapter
    // owned.
    cleanupOrphanImages(orphanPageIds);
  },

  addPagesToChapter: async (mangaId, chapterId, images) => {
    // The pure helper runs `processedImageToPage` on each image, which
    // writes the originals to IndexedDB and trims the metadata down to
    // what fits in localStorage. Returns the new state.
    const next = await addPagesToChapterPure(get(), mangaId, chapterId, images);
    set(next);
    saveLibrary(next);
  },

  setCurrentMangaId: id =>
    set(state => {
      const next = { ...state, currentMangaId: id };
      saveLibrary(next);
      return { currentMangaId: id };
    }),

  setCurrentChapterId: id =>
    set(state => {
      const next = { ...state, currentChapterId: id };
      saveLibrary(next);
      return { currentChapterId: id };
    }),

  runLegacyImagesMigration: async () => {
    // B12: the migration is now explicit, awaitable, and idempotent.
    // We pass the current snapshot so concurrent mutations during the
    // migration don't get clobbered.
    const next = await migrateLegacyImagesToIDB(get());
    // `migrateLegacyImagesToIDB` already saves when it writes, but it
    // returns a fresh object even on no-op so React subscribers see a
    // stable identity. Only commit when the contents actually changed
    // to avoid a redundant render.
    if (next !== get()) {
      set(next);
    }
  },
}));
