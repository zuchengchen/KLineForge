import { render } from 'solid-js/web';
import { App } from './App';
import { listenForTauriWindowResize } from './services/tauriWindowResize';
import './styles/app.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('KLineForge root element was not found.');
}

const unlistenTauriWindowResize = listenForTauriWindowResize();

if (import.meta.hot) {
  import.meta.hot.dispose(unlistenTauriWindowResize);
}

render(() => <App />, root);
