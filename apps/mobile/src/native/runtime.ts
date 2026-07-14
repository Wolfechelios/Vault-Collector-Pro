import { Capacitor } from '@capacitor/core';

type Runtime = Pick<typeof Capacitor, 'isNativePlatform' | 'getPlatform'>;

export function runtimePlatform(runtime: Runtime = Capacitor): 'ios' | 'android' | 'web' {
  if (!runtime.isNativePlatform()) return 'web';
  const platform = runtime.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

export const isNativeMobile = () => runtimePlatform() !== 'web';
