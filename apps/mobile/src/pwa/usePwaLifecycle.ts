import React from 'react';
import {useRegisterSW} from 'virtual:pwa-register/react';

type PwaStatusState = {offline: boolean; updateReady: boolean};
type PwaStatusEvent = 'offline' | 'online' | 'update-ready';

export function pwaStatusReducer(state: PwaStatusState, event: PwaStatusEvent): PwaStatusState {
  if (event === 'offline') return {...state, offline: true};
  if (event === 'online') return {...state, offline: false};
  return {...state, updateReady: true};
}

export function usePwaLifecycle() {
  const [status, dispatch] = React.useReducer(pwaStatusReducer, {
    offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    updateReady: false
  });
  const {needRefresh: [needRefresh], updateServiceWorker} = useRegisterSW({immediate: true});
  React.useEffect(() => { if (needRefresh) dispatch('update-ready'); }, [needRefresh]);
  React.useEffect(() => {
    const online = () => dispatch('online');
    const offline = () => dispatch('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);
  return {...status, applyUpdate: () => updateServiceWorker(true)};
}
