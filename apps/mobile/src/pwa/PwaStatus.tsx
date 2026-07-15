import React from 'react';
import {usePwaLifecycle} from './usePwaLifecycle';

export function PwaStatusView({offline, updateReady, onUpdate}: {offline: boolean; updateReady: boolean; onUpdate: () => void}) {
  if (!offline && !updateReady) return null;
  return <aside className="pwa-status" aria-live="polite">
    {offline && <span>Offline · local features available</span>}
    {updateReady && <><span>Update ready</span><button onClick={onUpdate}>Reload</button></>}
  </aside>;
}

export function PwaStatus() {
  const {offline, updateReady, applyUpdate} = usePwaLifecycle();
  return <PwaStatusView offline={offline} updateReady={updateReady} onUpdate={() => void applyUpdate()}/>;
}
