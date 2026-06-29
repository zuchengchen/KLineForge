import { describe, expect, it } from 'vitest';
import { LineStyle, type LogicalRange } from 'lightweight-charts';
import { areLogicalRangesEqual, shouldAutoFitChartData, toLightweightLineStyle } from './ChartPane';

describe('ChartPane viewport helpers', () => {
  it('auto-fits the initial non-empty dataset', () => {
    expect(
      shouldAutoFitChartData({
        dataReferenceChanged: true,
        hasPreviousData: false,
        pendingReset: true,
        renderedRows: 1000,
      }),
    ).toBe(true);
  });

  it('does not auto-fit live data updates without a pending reset', () => {
    expect(
      shouldAutoFitChartData({
        dataReferenceChanged: true,
        hasPreviousData: true,
        pendingReset: false,
        renderedRows: 1001,
      }),
    ).toBe(false);
  });

  it('auto-fits after a chart request reset supplies a new dataset', () => {
    expect(
      shouldAutoFitChartData({
        dataReferenceChanged: true,
        hasPreviousData: true,
        pendingReset: true,
        renderedRows: 1000,
      }),
    ).toBe(true);
  });

  it('keeps empty datasets from requesting a viewport fit', () => {
    expect(
      shouldAutoFitChartData({
        dataReferenceChanged: true,
        hasPreviousData: true,
        pendingReset: true,
        renderedRows: 0,
      }),
    ).toBe(false);
  });

  it('compares logical ranges with a small tolerance', () => {
    expect(areLogicalRangesEqual(logicalRange(1, 100), logicalRange(1.00001, 99.99999))).toBe(true);
    expect(areLogicalRangesEqual(logicalRange(1, 100), logicalRange(1.1, 100))).toBe(false);
  });

  it('maps configurable indicator line styles to Lightweight Charts styles', () => {
    expect(toLightweightLineStyle('solid')).toBe(LineStyle.Solid);
    expect(toLightweightLineStyle('dotted')).toBe(LineStyle.Dotted);
    expect(toLightweightLineStyle('dashed')).toBe(LineStyle.Dashed);
    expect(toLightweightLineStyle('large-dashed')).toBe(LineStyle.LargeDashed);
    expect(toLightweightLineStyle('sparse-dotted')).toBe(LineStyle.SparseDotted);
  });
});

function logicalRange(from: number, to: number): LogicalRange {
  return { from, to } as LogicalRange;
}
