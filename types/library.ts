// Tipos para a Biblioteca de Mangás

export interface MangaPage {
  id: string;
  fileName: string;
  imageUrl: string; // Base64 ou URL
  thumbnailUrl?: string; // Thumbnail menor para preview
  bubblesData: string; // JSON stringified dos bubbles
  maskDataUrl?: string;
  translatedImageUrl?: string;
  createdAt: number;
}

export interface Chapter {
  id: string;
  number: number;
  title?: string;
  pages: MangaPage[];
  createdAt: number;
  updatedAt: number;
}

export interface Manga {
  id: string;
  title: string;
  coverUrl?: string;
  chapters: Chapter[];
  createdAt: number;
  updatedAt: number;
}

export interface LibraryState {
  mangas: Manga[];
  currentMangaId: string | null;
  currentChapterId: string | null;
}
