import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import '../i18n/i18n';
import { App } from './App';

describe('App', () => {
  it('renders the KLineForge shell', () => {
    render(<App />);

    expect(screen.getByText('KLineForge')).toBeInTheDocument();
    expect(screen.getAllByText('BTCUSDT').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5m \/ 1h/i).length).toBeGreaterThan(0);
  });

  it('opens settings and changes theme', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Theme'), 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
