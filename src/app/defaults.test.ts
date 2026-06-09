import { describe, expect, it } from 'vitest';
import { createDefaultSession, createDefaultSettings } from './defaults';

describe('default application state', () => {
  it('uses the required first-launch market, symbol and intervals', () => {
    const session = createDefaultSession(100);

    expect(session.market).toBe('usdM');
    expect(session.symbol).toBe('BTCUSDT');
    expect(session.leftInterval).toBe('5m');
    expect(session.rightInterval).toBe('1h');
    expect(session.schemaVersion).toBe(1);
    expect(session.updatedAt).toBe(100);
  });

  it('uses dark theme and green-up red-down by default', () => {
    const settings = createDefaultSettings('en-US', 200);

    expect(settings.theme).toBe('dark');
    expect(settings.language).toBe('en-US');
    expect(settings.priceColorMode).toBe('green-up-red-down');
    expect(settings.schemaVersion).toBe(1);
    expect(settings.updatedAt).toBe(200);
  });
});
