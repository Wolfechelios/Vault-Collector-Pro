import {describe, expect, it} from 'vitest';
import config from '../../vite.config';

describe('mobile PWA configuration', () => {
  it('uses the GitHub Pages base path and PWA plugin', () => {
    expect(config.base).toBe('/Vault-Collector-Pro/');
    expect(config.plugins).toHaveLength(2);
  });
});
