import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';

export function installMatchMedia(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
      return { matches, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true };
    },
  });
}

export function renderAtViewport(ui: ReactElement, width: number, height = 800): RenderResult {
  installMatchMedia(width);
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  return render(ui);
}
