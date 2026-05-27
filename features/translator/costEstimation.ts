import { EngineId } from '../../types';

interface PricePerMillion {
  input: number;
  output: number;
}

export const ENGINE_PRICING: Record<EngineId, PricePerMillion> = {
  GEMINI_FLASH: { input: 0.15, output: 0.60 },
  GEMINI_FLASH_FULL: { input: 0.15, output: 0.60 },
  GEMINI_3_FLASH: { input: 0.15, output: 0.60 },
  GEMINI_3_FLASH_FULL: { input: 0.15, output: 0.60 },
  GEMINI_35_FLASH: { input: 0.15, output: 0.60 },
  GEMINI_35_FLASH_FULL: { input: 0.15, output: 0.60 },
  GEMINI_PRO: { input: 1.25, output: 10 },
  GEMINI_PRO_FULL: { input: 1.25, output: 10 },
  GPT4O: { input: 2.50, output: 10 },
  GPT4O_MINI: { input: 0.15, output: 0.60 },
  ICHIGO: { input: 0, output: 0 },
  TORII: { input: 0, output: 0 },
  DEEPL: { input: 0, output: 0 },
  GOOGLE: { input: 0, output: 0 },
};

// Average tokens per page estimates
const OCR_INPUT_TOKENS = 1500;
const OCR_OUTPUT_TOKENS = 500;
const TRANS_INPUT_TOKENS = 500;
const TRANS_OUTPUT_TOKENS = 500;

/**
 * Estimates the cost in USD for translating a given number of pages
 * using the specified OCR and translation engines.
 */
export function estimateCost(
  ocrEngine: EngineId,
  transEngine: EngineId,
  pageCount: number
): number {
  const ocrPricing = ENGINE_PRICING[ocrEngine];
  const transPricing = ENGINE_PRICING[transEngine];

  const costPerPage =
    (OCR_INPUT_TOKENS * ocrPricing.input +
      OCR_OUTPUT_TOKENS * ocrPricing.output +
      TRANS_INPUT_TOKENS * transPricing.input +
      TRANS_OUTPUT_TOKENS * transPricing.output) /
    1_000_000;

  return costPerPage * pageCount;
}
