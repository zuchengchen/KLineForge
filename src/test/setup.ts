import { expect } from 'vitest';

expect.extend({});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

HTMLCanvasElement.prototype.getContext = (() => ({
  beginPath: () => undefined,
  clearRect: () => undefined,
  clip: () => undefined,
  closePath: () => undefined,
  fill: () => undefined,
  fillRect: () => undefined,
  fillText: () => undefined,
  lineTo: () => undefined,
  measureText: () => ({ width: 0 }),
  moveTo: () => undefined,
  rect: () => undefined,
  restore: () => undefined,
  rotate: () => undefined,
  save: () => undefined,
  scale: () => undefined,
  setLineDash: () => undefined,
  setTransform: () => undefined,
  stroke: () => undefined,
  strokeRect: () => undefined,
  translate: () => undefined,
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
