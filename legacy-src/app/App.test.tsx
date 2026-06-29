import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n/i18n';
import { App } from './App';
import { createDefaultSession, createDefaultSettings } from './defaults';
import { useSessionStore } from './stores/sessionStore';

vi.mock('../persistence/settingsPersistence', () => ({
  loadPersistedSession: vi.fn(async () => null),
  loadPersistedSettings: vi.fn(async () => null),
  persistSession: vi.fn(async () => undefined),
  persistSettings: vi.fn(async () => undefined),
}));

describe('App', () => {
  beforeEach(() => {
    useSessionStore.setState({
      session: createDefaultSession(1),
      settings: createDefaultSettings('en-US', 1),
      hydrated: true,
    });
  });

  it('renders the KLineForge shell', () => {
    render(<App />);

    expect(screen.getByText('KLineForge')).toBeInTheDocument();
    expect(screen.getAllByText('BTCUSDT').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1:5m \/ 2:1h/i).length).toBeGreaterThan(0);
  });

  it('opens settings and changes theme', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Theme'), 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('renders quick layout switching and changes chart pane count', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByLabelText('1 chart')).toBeInTheDocument();
    expect(screen.getByLabelText('2 charts')).toBeInTheDocument();
    expect(screen.getByLabelText('3 charts')).toBeInTheDocument();
    expect(screen.getByLabelText('4 charts')).toBeInTheDocument();
    expect(document.querySelectorAll('.chart-pane')).toHaveLength(2);

    await user.click(screen.getByLabelText('1 chart'));
    expect(document.querySelectorAll('.chart-pane')).toHaveLength(1);

    await user.click(screen.getByLabelText('4 charts'));
    expect(document.querySelectorAll('.chart-pane')).toHaveLength(4);
  });

  it('exposes layout control in settings', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByLabelText('Chart layout')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Chart layout'), '3');
    expect(useSessionStore.getState().session.chartLayout).toBe(3);
    expect(document.querySelectorAll('.chart-pane')).toHaveLength(3);
  });
});
