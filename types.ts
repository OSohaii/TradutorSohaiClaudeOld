export type EngineId =
  | 'GEMINI_FLASH'
  | 'GEMINI_FLASH_FULL'
  | 'GEMINI_3_FLASH'
  | 'GEMINI_3_FLASH_FULL'
  | 'GEMINI_PRO'
  | 'GEMINI_PRO_FULL'
  | 'GEMINI_35_FLASH'
  | 'GEMINI_35_FLASH_FULL'
  | 'ICHIGO'
  | 'TORII'
  | 'DEEPL'
  | 'GOOGLE'
  | 'GPT4O'
  | 'GPT4O_MINI';

// Forward declarations for Phase 5 engine registry. These types will be
// consumed by the engine selection UI and capability-based routing logic.
export type OcrCapability = 'ocr';
export type TranslateCapability = 'translate';
export type ImageOutCapability = 'image-out';
export type EngineCapability = OcrCapability | TranslateCapability | ImageOutCapability;

export interface Engine {
  id: EngineId;
  label: string;
  capabilities: EngineCapability[];
  pricing?: { input: number; output: number };
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface TextBubble {
  id: string;
  originalText: string;
  translatedText: string;
  box: BoundingBox;
  type?: 'dialogue' | 'sfx'; // New field for identifying bubble type
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string; // 'normal' | 'bold'
  fontStyle?: string;  // 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  letterSpacing?: number;
  lineHeight?: number; // Multiplier: 1.0, 1.2, 1.5, etc.
  scale?: number; // Multiplier: 1.0 = 100%, 0.8 = 80%
  color?: string; // Cor do texto, ex: '#000000'
  rotation?: number; // Rotação em graus
}

export interface TranslationResult {
  bubbles: TextBubble[];
}

export enum ViewMode {
  ORIGINAL = 'ORIGINAL',
  TRANSLATED = 'TRANSLATED',
  SIDE_BY_SIDE = 'SIDE_BY_SIDE'
}

export interface ProcessedImage {
  id: string;
  fileName: string;
  imageUrl: string;
  base64: string;
  bubbles: TextBubble[];
  status: 'idle' | 'processing' | 'ocr-done' | 'done' | 'error';
  errorMessage?: string;
  maskDataUrl?: string; // Stores the painted whiteout layer
  translatedImageUrl?: string; // URL for server-side rendered translations (e.g. Torii)
}