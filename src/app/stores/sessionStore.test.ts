import { describe, expect, it } from 'vitest';
import { createDefaultSession, createDefaultSettings } from '../defaults';
import { useSessionStore } from './sessionStore';

describe('session store hydration', () => {
  it('hydrates persisted session and settings', () => {
    const session = {
      ...createDefaultSession(1),
      symbol: 'ETHUSDT',
      sidebarCollapsed: true,
    };
    const settings = {
      ...createDefaultSettings('en-US', 2),
      theme: 'light' as const,
    };

    useSessionStore.getState().hydrate(session, settings);

    expect(useSessionStore.getState().hydrated).toBe(true);
    expect(useSessionStore.getState().session.symbol).toBe('ETHUSDT');
    expect(useSessionStore.getState().session.sidebarCollapsed).toBe(true);
    expect(useSessionStore.getState().settings.theme).toBe('light');
  });
});
