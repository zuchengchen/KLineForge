import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/i18n';
import { database } from '../../persistence/database';
import type { IndicatorConfig } from '../../types/domain';
import { IndicatorSettingsDialog } from './IndicatorSettingsDialog';

const config: IndicatorConfig = {
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

describe('IndicatorSettingsDialog', () => {
  beforeEach(async () => {
    await database.delete();
    await database.open();
    await database.indicatorConfigs.put(config);
  });

  it('renders tabs and saves edited inputs', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<IndicatorSettingsDialog config={config} onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByRole('tab', { name: 'Inputs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Style' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Templates' })).toBeInTheDocument();

    const firstPeriod = screen.getByLabelText('Period 1');
    fireEvent.change(firstPeriod, { target: { value: '9' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    expect((await database.indicatorConfigs.get('ma'))?.calcParams[0]).toBe(9);
  });
});
