import { describe, expect, it } from 'vitest';
import {
  normalizeBinanceKline,
  normalizeFuturesMarketInfo,
  normalizeFuturesSymbol,
  normalizeSpotSymbol,
  normalizeTicker24h,
} from './normalizers';

const klineRow = [
  1710000000000,
  '100.00000000',
  '110.00000000',
  '90.00000000',
  '105.00000000',
  '123.45000000',
  1710000059999,
  '12962.25000000',
  42,
  '60.00000000',
  '6300.00000000',
  '0',
] as const;

describe('Binance normalizers', () => {
  it('normalizes Spot K-line arrays', () => {
    const kline = normalizeBinanceKline('spot', 'btcusdt', '1m', [...klineRow], 'rest', 200);

    expect(kline).toMatchObject({
      schemaVersion: 1,
      market: 'spot',
      symbol: 'BTCUSDT',
      interval: '1m',
      openTime: 1710000000000,
      open: '100.00000000',
      high: '110.00000000',
      low: '90.00000000',
      close: '105.00000000',
      volume: '123.45000000',
      closeTime: 1710000059999,
      quoteVolume: '12962.25000000',
      tradeCount: 42,
      takerBuyBaseVolume: '60.00000000',
      takerBuyQuoteVolume: '6300.00000000',
      isClosed: true,
      source: 'rest',
      updatedAt: 200,
    });
  });

  it('normalizes Futures K-line arrays', () => {
    const kline = normalizeBinanceKline('usdM', 'ethusdt', '1h', [...klineRow], 'rest', 300);

    expect(kline.market).toBe('usdM');
    expect(kline.symbol).toBe('ETHUSDT');
    expect(kline.interval).toBe('1h');
    expect(kline.openTime).toBe(1710000000000);
  });

  it('normalizes Spot symbols', () => {
    const symbol = normalizeSpotSymbol(
      {
        symbol: 'BTCUSDT',
        status: 'TRADING',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        baseAssetPrecision: 8,
        quoteAssetPrecision: 8,
        filters: [
          { filterType: 'PRICE_FILTER', tickSize: '0.01000000' },
          { filterType: 'LOT_SIZE', stepSize: '0.00001000' },
        ],
      },
      400,
    );

    expect(symbol).toMatchObject({
      market: 'spot',
      symbol: 'BTCUSDT',
      status: 'trading',
      tickSize: '0.01000000',
      stepSize: '0.00001000',
      updatedAt: 400,
    });
  });

  it('normalizes USD-M Futures symbols', () => {
    const symbol = normalizeFuturesSymbol(
      {
        symbol: 'BTCUSDT',
        status: 'TRADING',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        pricePrecision: 2,
        quantityPrecision: 3,
        contractType: 'PERPETUAL',
        onboardDate: 1569398400000,
        filters: [],
      },
      500,
    );

    expect(symbol).toMatchObject({
      market: 'usdM',
      contractType: 'perpetual',
      onboardDate: 1569398400000,
      updatedAt: 500,
    });
  });

  it('normalizes 24h tickers', () => {
    const ticker = normalizeTicker24h(
      'spot',
      {
        symbol: 'BTCUSDT',
        priceChange: '100.00',
        priceChangePercent: '1.25',
        lastPrice: '81000.00',
        highPrice: '82000.00',
        lowPrice: '79000.00',
        volume: '1000.00',
        quoteVolume: '81000000.00',
        openTime: 1,
        closeTime: 2,
        count: 99,
      },
      600,
    );

    expect(ticker).toMatchObject({
      market: 'spot',
      symbol: 'BTCUSDT',
      lastPrice: '81000.00',
      tradeCount: 99,
      updatedAt: 600,
    });
  });

  it('normalizes USD-M mark, index and funding information', () => {
    const info = normalizeFuturesMarketInfo({
      symbol: 'BTCUSDT',
      markPrice: '81001.00',
      indexPrice: '81000.50',
      lastFundingRate: '0.0001',
      nextFundingTime: 1710000000000,
      time: 1709990000000,
    });

    expect(info).toMatchObject({
      schemaVersion: 1,
      market: 'usdM',
      symbol: 'BTCUSDT',
      markPrice: '81001.00',
      indexPrice: '81000.50',
      fundingRate: '0.0001',
      nextFundingTime: 1710000000000,
      updatedAt: 1709990000000,
    });
  });
});
