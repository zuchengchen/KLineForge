import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the Tauri performance shell', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(() => <App />, root);

    expect(root.textContent).toContain('KLineForge');
  });
});
