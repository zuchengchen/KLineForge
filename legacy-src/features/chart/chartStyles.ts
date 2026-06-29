import type { CandleType } from 'klinecharts';
import type { ChartSettings } from '../../types/domain';

const candleTypeByChartStyle: Record<ChartSettings['chartStyle'], CandleType> = {
  candle: 'candle_solid',
  'hollow-candle': 'candle_stroke',
  line: 'area',
};

export function createChartStyles(settings: ChartSettings) {
  const dark = settings.theme === 'dark';
  const candleType = candleTypeByChartStyle[settings.chartStyle];
  const upColor = settings.priceColorMode === 'green-up-red-down' ? '#16c784' : '#ea3943';
  const downColor = settings.priceColorMode === 'green-up-red-down' ? '#ea3943' : '#16c784';

  return {
    grid: {
      show: settings.showGrid,
      horizontal: {
        color: dark ? 'rgba(132,150,176,0.14)' : 'rgba(96,110,130,0.18)',
      },
      vertical: {
        color: dark ? 'rgba(132,150,176,0.14)' : 'rgba(96,110,130,0.18)',
      },
    },
    candle: {
      type: candleType,
      bar: {
        upColor,
        downColor,
        noChangeColor: '#9ba8ba',
        upBorderColor: upColor,
        downBorderColor: downColor,
        noChangeBorderColor: '#9ba8ba',
        upWickColor: upColor,
        downWickColor: downColor,
        noChangeWickColor: '#9ba8ba',
      },
      priceMark: {
        show: settings.showLastPriceLine,
        last: {
          show: settings.showLastPriceLine,
        },
      },
      area: {
        lineColor: dark ? '#2f81f7' : '#1268d6',
        backgroundColor: dark ? 'rgba(47,129,247,0.14)' : 'rgba(47,129,247,0.12)',
      },
    },
    xAxis: {
      axisLine: {
        color: dark ? 'rgba(132,150,176,0.22)' : 'rgba(96,110,130,0.22)',
      },
      tickText: {
        color: dark ? '#9ba8ba' : '#5d6979',
      },
    },
    yAxis: {
      size: 'auto' as const,
      axisLine: {
        color: dark ? 'rgba(132,150,176,0.22)' : 'rgba(96,110,130,0.22)',
      },
      tickText: {
        color: dark ? '#9ba8ba' : '#5d6979',
      },
    },
    crosshair: {
      show: settings.showCrosshair,
      horizontal: {
        show: settings.showCrosshair,
      },
      vertical: {
        show: settings.showCrosshair,
      },
    },
  };
}
