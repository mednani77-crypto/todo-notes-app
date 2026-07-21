import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ||= ResizeObserverMock;

globalThis.matchMedia ||= (() => ({
  matches: false,
  media: '',
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() { return true; },
}));

globalThis.URL.createObjectURL ||= (() => 'blob:test');
globalThis.URL.revokeObjectURL ||= (() => {});

if (!navigator.storage) {
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 0, quota: 0 }) } });
}
