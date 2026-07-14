import { describe, expect, it } from 'vitest';
import { runtimePlatform } from './runtime';

describe('native runtime', () => {
  it('keeps browser development on the web adapter', () => {
    expect(runtimePlatform({ isNativePlatform: () => false, getPlatform: () => 'web' })).toBe('web');
  });

  it('reports the native platform', () => {
    expect(runtimePlatform({ isNativePlatform: () => true, getPlatform: () => 'android' })).toBe('android');
  });
});
