import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock blobUrls before importing the store
vi.mock('../../services/blobUrls', () => ({
  revokeIfBlob: vi.fn(),
  revokeImageUrls: vi.fn(),
  createTrackedObjectURL: vi.fn(() => 'blob:mock'),
}));

import { useSessionStore } from '../../store/useSessionStore';
import type { ProcessedImage, TextBubble } from '../../types';

function makeImage(id: string, bubbles: TextBubble[] = []): ProcessedImage {
  return {
    id,
    fileName: `${id}.png`,
    imageUrl: `blob:${id}`,
    base64: 'base64data',
    bubbles,
    status: 'done',
  };
}

function makeBubble(id: string, text = 'hello'): TextBubble {
  return {
    id,
    originalText: text,
    translatedText: `translated-${text}`,
    box: { ymin: 0, xmin: 0, ymax: 100, xmax: 100 },
  };
}

describe('useSessionStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useSessionStore.setState({
      currentImage: null,
      history: [],
      bubbleHistory: {},
    });
  });

  describe('addImages', () => {
    it('prepends images to history and sets currentImage to first new image', () => {
      const img1 = makeImage('img1');
      const img2 = makeImage('img2');

      useSessionStore.getState().addImages([img1, img2]);

      const state = useSessionStore.getState();
      expect(state.history).toHaveLength(2);
      expect(state.history[0]).toBe(img1);
      expect(state.history[1]).toBe(img2);
      expect(state.currentImage).toBe(img1);
    });

    it('prepends to existing history', () => {
      const existing = makeImage('existing');
      useSessionStore.setState({ history: [existing], currentImage: existing });

      const newImg = makeImage('new');
      useSessionStore.getState().addImages([newImg]);

      const state = useSessionStore.getState();
      expect(state.history).toHaveLength(2);
      expect(state.history[0]).toBe(newImg);
      expect(state.history[1]).toBe(existing);
      expect(state.currentImage).toBe(newImg);
    });
  });

  describe('removeImage', () => {
    it('removes an image by ID and refocuses to the next available', () => {
      const img1 = makeImage('img1');
      const img2 = makeImage('img2');
      useSessionStore.setState({ history: [img1, img2], currentImage: img1 });

      useSessionStore.getState().removeImage('img1');

      const state = useSessionStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toBe(img2);
      expect(state.currentImage).toBe(img2);
    });

    it('sets currentImage to null when removing the last image', () => {
      const img1 = makeImage('img1');
      useSessionStore.setState({ history: [img1], currentImage: img1 });

      useSessionStore.getState().removeImage('img1');

      const state = useSessionStore.getState();
      expect(state.history).toHaveLength(0);
      expect(state.currentImage).toBeNull();
    });
  });

  describe('updateImageState', () => {
    it('merges partial state into the matching image', () => {
      const img = makeImage('img1');
      useSessionStore.setState({ history: [img], currentImage: img });

      useSessionStore.getState().updateImageState('img1', { status: 'processing' });

      const state = useSessionStore.getState();
      expect(state.currentImage?.status).toBe('processing');
      expect(state.history[0].status).toBe('processing');
    });
  });

  describe('clearHistory', () => {
    it('resets to empty state', () => {
      const img = makeImage('img1');
      useSessionStore.setState({ history: [img], currentImage: img });

      useSessionStore.getState().clearHistory();

      const state = useSessionStore.getState();
      expect(state.history).toHaveLength(0);
      expect(state.currentImage).toBeNull();
      expect(state.bubbleHistory).toEqual({});
    });
  });

  describe('bubble undo/redo', () => {
    it('pushBubbleSnapshot captures current bubbles, undoBubbles restores, redoBubbles re-applies', () => {
      const bubble1 = makeBubble('b1', 'first');
      const bubble2 = makeBubble('b2', 'second');
      const img = makeImage('img1', [bubble1]);
      useSessionStore.setState({ history: [img], currentImage: img });

      // Push snapshot of initial state (before mutation)
      useSessionStore.getState().pushBubbleSnapshot();

      // Simulate mutation: add bubble2
      const updatedBubbles = [bubble1, bubble2];
      useSessionStore.setState(state => ({
        history: state.history.map(i =>
          i.id === 'img1' ? { ...i, bubbles: updatedBubbles } : i,
        ),
        currentImage: state.currentImage
          ? { ...state.currentImage, bubbles: updatedBubbles }
          : null,
      }));

      // Push snapshot of mutated state
      useSessionStore.getState().pushBubbleSnapshot();

      // Verify we now have the mutated bubbles
      expect(useSessionStore.getState().currentImage?.bubbles).toHaveLength(2);

      // Undo: should restore to snapshot at index 0 (the initial state)
      const undoResult = useSessionStore.getState().undoBubbles();
      expect(undoResult).toBe(true);
      expect(useSessionStore.getState().currentImage?.bubbles).toHaveLength(1);
      expect(useSessionStore.getState().currentImage?.bubbles[0].originalText).toBe('first');

      // Redo: should restore to snapshot at index 1 (the mutated state)
      const redoResult = useSessionStore.getState().redoBubbles();
      expect(redoResult).toBe(true);
      expect(useSessionStore.getState().currentImage?.bubbles).toHaveLength(2);
    });

    it('undoBubbles returns false when there is no history to undo', () => {
      const img = makeImage('img1', [makeBubble('b1')]);
      useSessionStore.setState({ history: [img], currentImage: img });

      const result = useSessionStore.getState().undoBubbles();
      expect(result).toBe(false);
    });

    it('redoBubbles returns false when there is nothing to redo', () => {
      const img = makeImage('img1', [makeBubble('b1')]);
      useSessionStore.setState({ history: [img], currentImage: img });

      useSessionStore.getState().pushBubbleSnapshot();
      const result = useSessionStore.getState().redoBubbles();
      expect(result).toBe(false);
    });
  });
});
