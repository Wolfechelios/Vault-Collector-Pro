import {describe, expect, it} from 'vitest';
import {pwaStatusReducer} from './usePwaLifecycle';

describe('PWA lifecycle state', () => {
  it('tracks offline and update-ready events without forcing reload', () => {
    const initial = {offline: false, updateReady: false};
    expect(pwaStatusReducer(initial, 'offline')).toEqual({offline: true, updateReady: false});
    expect(pwaStatusReducer(initial, 'update-ready')).toEqual({offline: false, updateReady: true});
    expect(pwaStatusReducer({offline: true, updateReady: true}, 'online')).toEqual({offline: false, updateReady: true});
  });
});
