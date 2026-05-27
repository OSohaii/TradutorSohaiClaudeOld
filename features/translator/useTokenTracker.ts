import { useMemo, useState } from 'react';
import type { TokenUsage } from '../../services/api/pipelineApi';

/**
 * Per-session token + cost tracking. Resets whenever the page reloads
 * (this is intentional -- the user-facing badge in the sidebar is "this
 * tab right now", not "ever").
 *
 * Pricing tiers below are estimates (USD per 1M tokens) and only
 * apply to Gemini variants; non-Gemini engines (DeepL, Google
 * Translate, Torii) report 0 tokens through this code path so they
 * don't influence the running total.
 */
const PRICING = {
  flash: { input: 0.1, output: 0.4 },
  pro: { input: 1.25, output: 5.0 },
} as const;

export interface TokenTracker {
  /** Cumulative input/output token counts since page load. */
  totalTokens: { input: number; output: number };
  /** Cumulative estimated USD cost since page load. */
  totalCost: number;
  /** Sum of `totalTokens.input + totalTokens.output`. */
  displayedTotalTokens: number;
  /** Per-engine breakdown of tokens and cost. */
  tokensByEngine: Record<string, { input: number; output: number; cost: number }>;
  /** Feed a `TokenUsage` payload from the BFF pipeline response. */
  handleTokenUsage: (data: TokenUsage) => void;
}

export const useTokenTracker = (): TokenTracker => {
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  const [totalCost, setTotalCost] = useState(0);
  const [tokensByEngine, setTokensByEngine] = useState<Record<string, { input: number; output: number; cost: number }>>({});

  const handleTokenUsage = (data: TokenUsage): void => {
    setTotalTokens(prev => ({
      input: prev.input + data.input,
      output: prev.output + data.output,
    }));

    const model = (data.model || '').toLowerCase();
    const tier =
      model.includes('flash') || model.includes('lite') ? PRICING.flash : PRICING.pro;
    const costIn = (data.input / 1_000_000) * tier.input;
    const costOut = (data.output / 1_000_000) * tier.output;
    setTotalCost(prev => prev + costIn + costOut);

    const key = data.engine || data.model || 'unknown';
    setTokensByEngine(prev => {
      const existing = prev[key] || { input: 0, output: 0, cost: 0 };
      return {
        ...prev,
        [key]: {
          input: existing.input + data.input,
          output: existing.output + data.output,
          cost: existing.cost + costIn + costOut,
        },
      };
    });
  };

  const displayedTotalTokens = useMemo(
    () => totalTokens.input + totalTokens.output,
    [totalTokens.input, totalTokens.output],
  );

  return { totalTokens, totalCost, displayedTotalTokens, tokensByEngine, handleTokenUsage };
};
