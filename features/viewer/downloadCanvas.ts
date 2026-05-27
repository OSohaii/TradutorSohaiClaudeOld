import { ProcessedImage } from '../../types';

export interface DownloadCanvasParams {
  image: ProcessedImage;
  imgElement: HTMLImageElement;
  canvasElement: HTMLCanvasElement | null;
  defaultFont?: string;
  globalBold: boolean;
  globalItalic: boolean;
  globalBubbleScale: number;
  isBubbleTransparent: boolean;
  showTextStroke: boolean;
  calculatedFontSizes: Record<string, number>;
}

export async function downloadCanvas(params: DownloadCanvasParams): Promise<void> {
  const {
    image,
    imgElement,
    canvasElement,
    defaultFont,
    globalBold,
    globalItalic,
    globalBubbleScale,
    isBubbleTransparent,
    showTextStroke,
    calculatedFontSizes,
  } = params;

  const img = imgElement;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Pre-load all fonts used by bubbles
  const uniqueFonts = [...new Set(image.bubbles.map(b => b.fontFamily || defaultFont || 'sans-serif'))];
  await Promise.all(uniqueFonts.map(f => document.fonts.load(`bold 16px ${f}`).catch(() => {})));
  await document.fonts.ready;

  // 1. Draw base image
  ctx.drawImage(img, 0, 0);

  // 2. Draw mask/paint layer
  if (canvasElement) {
    ctx.drawImage(canvasElement, 0, 0);
  }

  // Helper: draw rounded rect using arc (no roundRect for compat)
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 3. Draw bubbles
  for (const bubble of image.bubbles) {
    const bWidth = (bubble.box.xmax - bubble.box.xmin) / 1000 * canvas.width;
    const bHeight = (bubble.box.ymax - bubble.box.ymin) / 1000 * canvas.height;
    const bx = bubble.box.xmin / 1000 * canvas.width;
    const by = bubble.box.ymin / 1000 * canvas.height;

    const bubbleScale = bubble.scale ?? globalBubbleScale;
    const sWidth = bWidth * bubbleScale;
    const sHeight = bHeight * bubbleScale;
    const sx = bx + (bWidth - sWidth) / 2;
    const sy = by + (bHeight - sHeight) / 2;

    const centerX = sx + sWidth / 2;
    const centerY = sy + sHeight / 2;
    const rot = (bubble.rotation || 0) * Math.PI / 180;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rot);

    // Draw background
    if (!isBubbleTransparent && bubble.type !== 'sfx') {
      ctx.fillStyle = 'white';
      drawRoundedRect(-sWidth / 2, -sHeight / 2, sWidth, sHeight, 10);
      ctx.fill();
    }

    // Text properties
    const bFontSize = bubble.fontSize || calculatedFontSizes[bubble.id] || 14;
    const bFont = bubble.fontFamily || defaultFont || 'sans-serif';
    const bWeight = bubble.fontWeight || (globalBold ? 'bold' : 'normal');
    const bStyle = bubble.fontStyle || (globalItalic ? 'italic' : 'normal');
    const bColor = bubble.color || '#000000';
    const bLineHeight = (bubble.lineHeight || 1.15) * bFontSize;
    const shouldUpper = bFont.includes("CC Wild Words Roman BR") || bFont.includes("Anime Ace BR");

    ctx.font = `${bStyle} ${bWeight} ${bFontSize}px ${bFont}`;
    ctx.textAlign = (bubble.textAlign || 'center') as CanvasTextAlign;
    ctx.textBaseline = 'middle';

    // Apply textTransform
    let text = bubble.translatedText;
    if (shouldUpper) text = text.toUpperCase();

    // Word wrap
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const maxLineWidth = sWidth * 0.9;
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxLineWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const totalTextHeight = lines.length * bLineHeight;
    const textStartY = -totalTextHeight / 2 + bLineHeight / 2;
    const textX = bubble.textAlign === 'left' ? -sWidth * 0.45
                 : bubble.textAlign === 'right' ? sWidth * 0.45
                 : 0;

    // Draw text-shadow conditionally to match BubbleOverlay behavior:
    // - showTextStroke ON: strong 4-offset white stroke
    // - showTextStroke OFF + (transparent or sfx): glow effect (double white fill)
    // - showTextStroke OFF + normal bubble: no shadow
    // NOTE: Canvas 2D does not support letterSpacing natively, so it is
    // intentionally omitted here. This matches browser canvas limitations.
    if (showTextStroke) {
      const shadowOffset = 1;
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy] of [[-shadowOffset, -shadowOffset], [shadowOffset, -shadowOffset], [-shadowOffset, shadowOffset], [shadowOffset, shadowOffset]] as [number, number][]) {
        let lineY = textStartY;
        for (const line of lines) {
          ctx.fillText(line.trim(), textX + dx, lineY + dy);
          lineY += bLineHeight;
        }
      }
    } else if (isBubbleTransparent || bubble.type === 'sfx') {
      // Glow effect: draw white text twice with slight blur to mimic
      // CSS "0px 0px 3px white, 0px 0px 3px white"
      ctx.save();
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#ffffff';
      for (let pass = 0; pass < 2; pass++) {
        let lineY = textStartY;
        for (const line of lines) {
          ctx.fillText(line.trim(), textX, lineY);
          lineY += bLineHeight;
        }
      }
      ctx.restore();
    }

    // Draw main text
    ctx.fillStyle = bColor;
    let lineY = textStartY;
    for (const line of lines) {
      ctx.fillText(line.trim(), textX, lineY);
      lineY += bLineHeight;
    }

    ctx.restore();
  }

  const link = document.createElement('a');
  link.download = `traducao_${image.fileName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
