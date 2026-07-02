import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';

const tauriWindowResizeEvent = 'klineforge:tauri-window-resize';

export function listenForTauriWindowResize() {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return () => undefined;
  }

  const dispatchResize = () => {
    window.dispatchEvent(new Event(tauriWindowResizeEvent));
    window.dispatchEvent(new Event('resize'));
  };

  const currentWindow = getCurrentWindow();
  const unlistenPromises = [
    currentWindow.onResized(dispatchResize),
    currentWindow.onScaleChanged(dispatchResize),
  ];

  void getCurrentWebview().setAutoResize(true).catch((error: unknown) => {
    console.warn('Tauri webview auto-resize could not be enabled', error);
  });

  return () => {
    for (const unlistenPromise of unlistenPromises) {
      void unlistenPromise.then((unlisten) => unlisten());
    }
  };
}

export function tauriResizeEventNameForTests() {
  return tauriWindowResizeEvent;
}
