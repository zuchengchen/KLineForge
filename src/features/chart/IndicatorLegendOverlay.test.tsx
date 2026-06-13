import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n/i18n';
import type { IndicatorConfig } from '../../types/domain';
import { IndicatorLegendOverlay } from './IndicatorLegendOverlay';

const maConfig: IndicatorConfig = {
  id: 'ma',
  schemaVersion: 1,
  market: 'usdM',
  symbol: 'BTCUSDT',
  chartId: 'left',
  interval: '5m',
  name: 'MA',
  pane: 'main',
  visible: true,
  calcParams: [5, 10],
  color: '#fff',
  lineWidth: 1,
  createdAt: 1,
  updatedAt: 1,
};

describe('IndicatorLegendOverlay', () => {
  it('renders OHLC and indicator rows and opens settings from row action', async () => {
    const onOpenSettings = vi.fn();
    const user = userEvent.setup();

    render(
      <IndicatorLegendOverlay
        candle={{ timestamp: 1, open: 10, high: 15, low: 10, close: 12 }}
        hoveredIndicatorId="ma"
        indicatorGroups={[{ paneId: 'candle_pane', top: 0, configs: [maConfig] }]}
        pricePrecision={2}
        selectedIndicatorId="ma"
        onDeleteIndicator={vi.fn()}
        onHoverIndicator={vi.fn()}
        onOpenSettings={onOpenSettings}
        onSelectIndicator={vi.fn()}
        onToggleIndicator={vi.fn()}
      />,
    );

    expect(screen.getByText(/O 10.00/)).toBeInTheDocument();
    expect(screen.getByText(/R 50.00%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select MA indicator' })).toHaveTextContent('MA 5 10');

    await user.click(screen.getByRole('button', { name: 'Indicator settings' }));

    expect(onOpenSettings).toHaveBeenCalledWith(expect.objectContaining({ id: 'ma' }));
  });
});
