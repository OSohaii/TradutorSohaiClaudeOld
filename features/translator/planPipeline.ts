import { EngineId } from '../../types';

export type PipelineStep =
  | { kind: 'unified-gemini'; model: string }
  | { kind: 'image-engine'; engine: EngineId }
  | { kind: 'ocr-only'; engine: EngineId }
  | { kind: 'translate-only'; engine: EngineId }
  | { kind: 'inpaint-cleaner'; engine: EngineId };

interface PlanOptions {
  useToriiForCleaning: boolean;
}

const isGemini = (e: EngineId): boolean =>
  e.startsWith('GEMINI_');

export function planPipeline(ocr: EngineId, trans: EngineId, opts: PlanOptions): PipelineStep[] {
  const steps: PipelineStep[] = [];

  if (ocr === 'TORII' || trans === 'TORII') {
    // Torii handles OCR + translation + render as one unit
    steps.push({ kind: 'image-engine', engine: 'TORII' });
  } else if (ocr === trans && isGemini(ocr)) {
    // Same Gemini model for both OCR and translation - unified call
    steps.push({ kind: 'unified-gemini', model: ocr });
  } else {
    steps.push({ kind: 'ocr-only', engine: ocr });
    steps.push({ kind: 'translate-only', engine: trans });
  }

  // Cleaner runs in parallel when not already using Torii
  const usesTorii = steps.some(s => s.kind === 'image-engine');
  if (opts.useToriiForCleaning && !usesTorii) {
    steps.push({ kind: 'inpaint-cleaner', engine: 'TORII' });
  }

  return steps;
}
