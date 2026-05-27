import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenTracker } from '../../features/translator/useTokenTracker';

describe('useTokenTracker', () => {
  it('starts with zero tokens and zero cost', () => {
    const { result } = renderHook(() => useTokenTracker());
    expect(result.current.totalTokens).toEqual({ input: 0, output: 0 });
    expect(result.current.totalCost).toBe(0);
    expect(result.current.displayedTotalTokens).toBe(0);
  });

  it('accumulates tokens correctly across multiple calls', () => {
    const { result } = renderHook(() => useTokenTracker());

    act(() => {
      result.current.handleTokenUsage({ input: 100, output: 50, total: 150, model: 'gemini-flash' });
    });
    expect(result.current.totalTokens).toEqual({ input: 100, output: 50 });
    expect(result.current.displayedTotalTokens).toBe(150);

    act(() => {
      result.current.handleTokenUsage({ input: 200, output: 100, total: 300, model: 'gemini-flash' });
    });
    expect(result.current.totalTokens).toEqual({ input: 300, output: 150 });
    expect(result.current.displayedTotalTokens).toBe(450);
  });

  it('calculates flash model pricing: input = (tokens/1M)*0.1, output = (tokens/1M)*0.4', () => {
    const { result } = renderHook(() => useTokenTracker());

    act(() => {
      result.current.handleTokenUsage({
        input: 1_000_000,
        output: 1_000_000,
        total: 2_000_000,
        model: 'gemini-flash',
      });
    });

    // flash: input cost = 1M/1M * 0.1 = 0.1, output cost = 1M/1M * 0.4 = 0.4
    expect(result.current.totalCost).toBeCloseTo(0.5, 5);
  });

  it('calculates pro model pricing: input = (tokens/1M)*1.25, output = (tokens/1M)*5.0', () => {
    const { result } = renderHook(() => useTokenTracker());

    act(() => {
      result.current.handleTokenUsage({
        input: 1_000_000,
        output: 1_000_000,
        total: 2_000_000,
        model: 'gemini-pro',
      });
    });

    // pro: input cost = 1M/1M * 1.25 = 1.25, output cost = 1M/1M * 5.0 = 5.0
    expect(result.current.totalCost).toBeCloseTo(6.25, 5);
  });

  it('tracks per-engine breakdown in tokensByEngine', () => {
    const { result } = renderHook(() => useTokenTracker());

    act(() => {
      result.current.handleTokenUsage({
        input: 500,
        output: 200,
        total: 700,
        model: 'gemini-flash',
        engine: 'gemini',
      });
    });

    expect(result.current.tokensByEngine['gemini']).toBeDefined();
    expect(result.current.tokensByEngine['gemini'].input).toBe(500);
    expect(result.current.tokensByEngine['gemini'].output).toBe(200);
    expect(result.current.tokensByEngine['gemini'].cost).toBeGreaterThan(0);
  });
});
