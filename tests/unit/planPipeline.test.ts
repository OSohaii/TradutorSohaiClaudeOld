import { describe, it, expect } from 'vitest';
import { planPipeline } from '../../features/translator/planPipeline';

describe('planPipeline', () => {
  it('produces a single unified-gemini step when OCR and translate are the same Gemini engine', () => {
    const steps = planPipeline('GEMINI_FLASH', 'GEMINI_FLASH', { useToriiForCleaning: false });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ kind: 'unified-gemini', model: 'GEMINI_FLASH' });
  });

  it('produces separate ocr-only + translate-only steps when engines differ', () => {
    const steps = planPipeline('GEMINI_FLASH', 'DEEPL', { useToriiForCleaning: false });
    expect(steps).toHaveLength(2);
    expect(steps[0]).toEqual({ kind: 'ocr-only', engine: 'GEMINI_FLASH' });
    expect(steps[1]).toEqual({ kind: 'translate-only', engine: 'DEEPL' });
  });

  it('produces a single image-engine step when OCR is TORII', () => {
    const steps = planPipeline('TORII', 'DEEPL', { useToriiForCleaning: false });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ kind: 'image-engine', engine: 'TORII' });
  });

  it('produces a single image-engine step when translate is TORII', () => {
    const steps = planPipeline('GEMINI_FLASH', 'TORII', { useToriiForCleaning: false });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ kind: 'image-engine', engine: 'TORII' });
  });

  it('appends inpaint-cleaner step when useToriiForCleaning=true and not using Torii as primary', () => {
    const steps = planPipeline('GEMINI_FLASH', 'DEEPL', { useToriiForCleaning: true });
    expect(steps).toHaveLength(3);
    expect(steps[2]).toEqual({ kind: 'inpaint-cleaner', engine: 'TORII' });
  });

  it('does NOT append inpaint-cleaner when Torii is already the primary engine', () => {
    const steps = planPipeline('TORII', 'DEEPL', { useToriiForCleaning: true });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ kind: 'image-engine', engine: 'TORII' });
  });
});
