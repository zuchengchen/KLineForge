use crate::domain::{
    ChartPoint, IndicatorInstance, IndicatorKind, IndicatorParams, IndicatorSeries,
    IndicatorSeriesPoint, IndicatorSeriesType, IndicatorValue,
};

pub fn calculate_default_indicators(points: &[ChartPoint]) -> Vec<IndicatorValue> {
    let closes: Vec<f64> = points.iter().map(|point| point.close).collect();
    let ma5 = moving_average(&closes, 5);
    let ma10 = moving_average(&closes, 10);
    let ma30 = moving_average(&closes, 30);
    let boll = bollinger_bands(&closes, 20, 2.0);
    let ema12 = exponential_moving_average(&closes, 12);
    let ema26 = exponential_moving_average(&closes, 26);
    let macd = macd(&closes, 12, 26, 9);
    let rsi14 = relative_strength_index(&closes, 14);
    let atr14 = average_true_range(points, 14);
    let supertrend = supertrend(points, 10, 3.0);
    let kdj = kdj(points, 9, 3, 3);

    points
        .iter()
        .enumerate()
        .map(|(index, point)| IndicatorValue {
            time: point.time,
            ma5: ma5[index],
            ma10: ma10[index],
            ma30: ma30[index],
            boll_mid: boll[index].map(|value| value.0),
            boll_up: boll[index].map(|value| value.1),
            boll_down: boll[index].map(|value| value.2),
            ema12: ema12[index],
            ema26: ema26[index],
            macd_dif: macd[index].map(|value| value.0),
            macd_dea: macd[index].map(|value| value.1),
            macd: macd[index].map(|value| value.2),
            rsi14: rsi14[index],
            atr14: atr14[index],
            supertrend: supertrend[index].map(|value| value.0),
            supertrend_direction: supertrend[index].map(|value| value.1),
            kdj_k: kdj[index].map(|value| value.0),
            kdj_d: kdj[index].map(|value| value.1),
            kdj_j: kdj[index].map(|value| value.2),
        })
        .collect()
}

pub fn calculate_indicator_series(
    points: &[ChartPoint],
    instances: &[IndicatorInstance],
) -> Vec<IndicatorSeries> {
    let closes: Vec<f64> = points.iter().map(|point| point.close).collect();
    let mut series = Vec::new();

    for instance in instances.iter().filter(|instance| instance.enabled) {
        match &instance.params {
            IndicatorParams::Volume => {
                let Some(style) = instance.styles.get("volume").cloned() else {
                    continue;
                };
                series.push(IndicatorSeries {
                    id: format!("{}:volume", instance.id),
                    instance_id: instance.id.clone(),
                    key: "volume".to_string(),
                    label: "Volume".to_string(),
                    series_type: IndicatorSeriesType::Histogram,
                    pane: 0,
                    price_scale_id: Some("volume".to_string()),
                    style,
                    data: points
                        .iter()
                        .map(|point| IndicatorSeriesPoint {
                            time: point.time,
                            value: point.volume,
                            color: Some(if point.close >= point.open {
                                "#22ab9444".to_string()
                            } else {
                                "#f2364544".to_string()
                            }),
                        })
                        .collect(),
                });
            }
            IndicatorParams::Ma { periods } => {
                for period in periods {
                    let key = period.to_string();
                    push_line_series(
                        &mut series,
                        instance,
                        &key,
                        &format!("MA{period}"),
                        0,
                        moving_average(&closes, *period as usize),
                        points,
                    );
                }
            }
            IndicatorParams::Ema { periods } => {
                for period in periods {
                    let key = period.to_string();
                    push_line_series(
                        &mut series,
                        instance,
                        &key,
                        &format!("EMA{period}"),
                        0,
                        exponential_moving_average(&closes, *period as usize),
                        points,
                    );
                }
            }
            IndicatorParams::Boll { period, multiplier } => {
                let values = bollinger_bands(&closes, *period as usize, *multiplier);
                push_tuple_series(
                    &mut series,
                    instance,
                    "up",
                    "BOLL UP",
                    0,
                    values
                        .iter()
                        .map(|value| value.map(|(_, up, _)| up))
                        .collect(),
                    points,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "mid",
                    "BOLL MID",
                    0,
                    values
                        .iter()
                        .map(|value| value.map(|(mid, _, _)| mid))
                        .collect(),
                    points,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "down",
                    "BOLL DOWN",
                    0,
                    values
                        .iter()
                        .map(|value| value.map(|(_, _, down)| down))
                        .collect(),
                    points,
                );
            }
            IndicatorParams::Macd {
                short_period,
                long_period,
                signal_period,
            } => {
                let values = macd(
                    &closes,
                    *short_period as usize,
                    *long_period as usize,
                    *signal_period as usize,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "dif",
                    "DIF",
                    oscillator_pane(instance.kind),
                    values
                        .iter()
                        .map(|value| value.map(|(dif, _, _)| dif))
                        .collect(),
                    points,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "dea",
                    "DEA",
                    oscillator_pane(instance.kind),
                    values
                        .iter()
                        .map(|value| value.map(|(_, dea, _)| dea))
                        .collect(),
                    points,
                );
                push_histogram_series(
                    &mut series,
                    instance,
                    "histogram",
                    "MACD",
                    oscillator_pane(instance.kind),
                    values
                        .iter()
                        .map(|value| value.map(|(_, _, histogram)| histogram))
                        .collect(),
                    points,
                );
            }
            IndicatorParams::Rsi { period } => push_line_series(
                &mut series,
                instance,
                "rsi",
                &format!("RSI{period}"),
                oscillator_pane(instance.kind),
                relative_strength_index(&closes, *period as usize),
                points,
            ),
            IndicatorParams::Atr { period } => push_line_series(
                &mut series,
                instance,
                "atr",
                &format!("ATR{period}"),
                oscillator_pane(instance.kind),
                average_true_range(points, *period as usize),
                points,
            ),
            IndicatorParams::Kdj {
                period,
                k_smoothing,
                d_smoothing,
            } => {
                let values = kdj(
                    points,
                    *period as usize,
                    *k_smoothing as usize,
                    *d_smoothing as usize,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "k",
                    "K",
                    oscillator_pane(instance.kind),
                    values
                        .iter()
                        .map(|value| value.map(|(k, _, _)| k))
                        .collect(),
                    points,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "d",
                    "D",
                    oscillator_pane(instance.kind),
                    values
                        .iter()
                        .map(|value| value.map(|(_, d, _)| d))
                        .collect(),
                    points,
                );
                push_tuple_series(
                    &mut series,
                    instance,
                    "j",
                    "J",
                    oscillator_pane(instance.kind),
                    values
                        .iter()
                        .map(|value| value.map(|(_, _, j)| j))
                        .collect(),
                    points,
                );
            }
            IndicatorParams::Supertrend { period, multiplier } => {
                let values = supertrend(points, *period as usize, *multiplier);
                let Some(style) = instance.styles.get("supertrend").cloned() else {
                    continue;
                };
                series.push(IndicatorSeries {
                    id: format!("{}:supertrend", instance.id),
                    instance_id: instance.id.clone(),
                    key: "supertrend".to_string(),
                    label: format!("Supertrend{period}"),
                    series_type: IndicatorSeriesType::Line,
                    pane: 0,
                    price_scale_id: None,
                    style,
                    data: points
                        .iter()
                        .zip(values.iter())
                        .filter_map(|(point, value)| {
                            value.map(|(trend, direction)| IndicatorSeriesPoint {
                                time: point.time,
                                value: trend,
                                color: Some(
                                    if direction >= 0 { "#22ab94" } else { "#f23645" }.to_string(),
                                ),
                            })
                        })
                        .collect(),
                });
            }
        }
    }

    series
}

fn push_line_series(
    series: &mut Vec<IndicatorSeries>,
    instance: &IndicatorInstance,
    key: &str,
    label: &str,
    pane: u8,
    values: Vec<Option<f64>>,
    points: &[ChartPoint],
) {
    push_numeric_series(
        series,
        SeriesSpec {
            instance,
            key,
            label,
            series_type: IndicatorSeriesType::Line,
            pane,
            values,
            points,
            color_by_sign: false,
        },
    );
}

fn push_tuple_series(
    series: &mut Vec<IndicatorSeries>,
    instance: &IndicatorInstance,
    key: &str,
    label: &str,
    pane: u8,
    values: Vec<Option<f64>>,
    points: &[ChartPoint],
) {
    push_line_series(series, instance, key, label, pane, values, points);
}

fn push_histogram_series(
    series: &mut Vec<IndicatorSeries>,
    instance: &IndicatorInstance,
    key: &str,
    label: &str,
    pane: u8,
    values: Vec<Option<f64>>,
    points: &[ChartPoint],
) {
    push_numeric_series(
        series,
        SeriesSpec {
            instance,
            key,
            label,
            series_type: IndicatorSeriesType::Histogram,
            pane,
            values,
            points,
            color_by_sign: true,
        },
    );
}

struct SeriesSpec<'a> {
    instance: &'a IndicatorInstance,
    key: &'a str,
    label: &'a str,
    series_type: IndicatorSeriesType,
    pane: u8,
    values: Vec<Option<f64>>,
    points: &'a [ChartPoint],
    color_by_sign: bool,
}

fn push_numeric_series(series: &mut Vec<IndicatorSeries>, spec: SeriesSpec<'_>) {
    let Some(style) = spec.instance.styles.get(spec.key).cloned() else {
        return;
    };

    series.push(IndicatorSeries {
        id: format!("{}:{}", spec.instance.id, spec.key),
        instance_id: spec.instance.id.clone(),
        key: spec.key.to_string(),
        label: spec.label.to_string(),
        series_type: spec.series_type,
        pane: spec.pane,
        price_scale_id: None,
        style,
        data: spec
            .points
            .iter()
            .zip(spec.values.iter())
            .filter_map(|(point, value)| {
                value.map(|value| IndicatorSeriesPoint {
                    time: point.time,
                    value,
                    color: spec.color_by_sign.then(|| {
                        if value >= 0.0 {
                            "#22ab9466".to_string()
                        } else {
                            "#f2364566".to_string()
                        }
                    }),
                })
            })
            .collect(),
    });
}

fn oscillator_pane(kind: IndicatorKind) -> u8 {
    match kind {
        IndicatorKind::Macd => 1,
        IndicatorKind::Rsi => 2,
        IndicatorKind::Atr => 3,
        IndicatorKind::Kdj => 4,
        _ => 0,
    }
}

pub fn moving_average(values: &[f64], period: usize) -> Vec<Option<f64>> {
    let mut result = vec![None; values.len()];
    let mut sum = 0.0;

    for (index, value) in values.iter().enumerate() {
        sum += value;

        if index >= period {
            sum -= values[index - period];
        }

        if index + 1 >= period {
            result[index] = Some(sum / period as f64);
        }
    }

    result
}

pub fn exponential_moving_average(values: &[f64], period: usize) -> Vec<Option<f64>> {
    let mut result = vec![None; values.len()];
    let alpha = 2.0 / (period as f64 + 1.0);
    let mut ema = 0.0;

    for (index, value) in values.iter().enumerate() {
        if index == period - 1 {
            ema = values[..period].iter().sum::<f64>() / period as f64;
            result[index] = Some(ema);
        } else if index >= period {
            ema = value * alpha + ema * (1.0 - alpha);
            result[index] = Some(ema);
        }
    }

    result
}

pub fn relative_strength_index(values: &[f64], period: usize) -> Vec<Option<f64>> {
    let mut result = vec![None; values.len()];

    if values.len() <= period {
        return result;
    }

    let mut avg_gain = 0.0;
    let mut avg_loss = 0.0;

    for index in 1..values.len() {
        let change = values[index] - values[index - 1];
        let gain = change.max(0.0);
        let loss = (-change).max(0.0);

        if index <= period {
            avg_gain += gain;
            avg_loss += loss;

            if index == period {
                avg_gain /= period as f64;
                avg_loss /= period as f64;
            }
        } else {
            avg_gain = (avg_gain * (period as f64 - 1.0) + gain) / period as f64;
            avg_loss = (avg_loss * (period as f64 - 1.0) + loss) / period as f64;
        }

        if index >= period {
            result[index] = Some(if avg_loss == 0.0 {
                100.0
            } else {
                let relative_strength = avg_gain / avg_loss;
                100.0 - 100.0 / (1.0 + relative_strength)
            });
        }
    }

    result
}

pub fn bollinger_bands(
    values: &[f64],
    period: usize,
    multiplier: f64,
) -> Vec<Option<(f64, f64, f64)>> {
    let mut result = vec![None; values.len()];

    for index in period.saturating_sub(1)..values.len() {
        let window = &values[index + 1 - period..=index];
        let mean = window.iter().sum::<f64>() / period as f64;
        let variance = window
            .iter()
            .map(|value| {
                let delta = value - mean;
                delta * delta
            })
            .sum::<f64>()
            / period as f64;
        let deviation = variance.sqrt();

        result[index] = Some((
            mean,
            mean + multiplier * deviation,
            mean - multiplier * deviation,
        ));
    }

    result
}

pub fn macd(
    values: &[f64],
    short_period: usize,
    long_period: usize,
    signal_period: usize,
) -> Vec<Option<(f64, f64, f64)>> {
    let short = exponential_moving_average(values, short_period);
    let long = exponential_moving_average(values, long_period);
    let dif_values: Vec<f64> = values
        .iter()
        .enumerate()
        .map(|(index, _)| short[index].unwrap_or(0.0) - long[index].unwrap_or(0.0))
        .collect();
    let dea = exponential_moving_average(&dif_values, signal_period);

    values
        .iter()
        .enumerate()
        .map(|(index, _)| {
            let dif = dif_values[index];
            dea[index].map(|dea_value| (dif, dea_value, (dif - dea_value) * 2.0))
        })
        .collect()
}

pub fn average_true_range(points: &[ChartPoint], period: usize) -> Vec<Option<f64>> {
    let ranges: Vec<f64> = points
        .iter()
        .enumerate()
        .map(|(index, point)| {
            let Some(previous) = index
                .checked_sub(1)
                .and_then(|previous_index| points.get(previous_index))
            else {
                return point.high - point.low;
            };

            (point.high - point.low)
                .max((point.high - previous.close).abs())
                .max((point.low - previous.close).abs())
        })
        .collect();

    exponential_wilder_average(&ranges, period)
}

pub fn kdj(
    points: &[ChartPoint],
    period: usize,
    k_period: usize,
    d_period: usize,
) -> Vec<Option<(f64, f64, f64)>> {
    let mut result = vec![None; points.len()];
    let mut previous_k = 50.0;
    let mut previous_d = 50.0;

    for index in period.saturating_sub(1)..points.len() {
        let window = &points[index + 1 - period..=index];
        let highest = window
            .iter()
            .map(|point| point.high)
            .fold(f64::MIN, f64::max);
        let lowest = window
            .iter()
            .map(|point| point.low)
            .fold(f64::MAX, f64::min);
        let rsv = if (highest - lowest).abs() < f64::EPSILON {
            50.0
        } else {
            (points[index].close - lowest) / (highest - lowest) * 100.0
        };
        let k = (previous_k * (k_period as f64 - 1.0) + rsv) / k_period as f64;
        let d = (previous_d * (d_period as f64 - 1.0) + k) / d_period as f64;
        let j = 3.0 * k - 2.0 * d;

        previous_k = k;
        previous_d = d;
        result[index] = Some((k, d, j));
    }

    result
}

pub fn supertrend(points: &[ChartPoint], period: usize, multiplier: f64) -> Vec<Option<(f64, i8)>> {
    let atr = average_true_range(points, period);
    let mut result = vec![None; points.len()];
    let mut final_upper = 0.0;
    let mut final_lower = 0.0;
    let mut direction = 1_i8;

    for index in 0..points.len() {
        let Some(atr_value) = atr[index] else {
            continue;
        };

        let hl2 = (points[index].high + points[index].low) / 2.0;
        let basic_upper = hl2 + multiplier * atr_value;
        let basic_lower = hl2 - multiplier * atr_value;

        if index == period - 1 {
            final_upper = basic_upper;
            final_lower = basic_lower;
            result[index] = Some((final_lower, direction));
            continue;
        }

        let previous_close = points[index - 1].close;
        final_upper = if basic_upper < final_upper || previous_close > final_upper {
            basic_upper
        } else {
            final_upper
        };
        final_lower = if basic_lower > final_lower || previous_close < final_lower {
            basic_lower
        } else {
            final_lower
        };

        if direction < 0 && points[index].close > final_upper {
            direction = 1;
        } else if direction > 0 && points[index].close < final_lower {
            direction = -1;
        }

        let trend = if direction > 0 {
            final_lower
        } else {
            final_upper
        };
        result[index] = Some((trend, direction));
    }

    result
}

fn exponential_wilder_average(values: &[f64], period: usize) -> Vec<Option<f64>> {
    let mut result = vec![None; values.len()];

    if values.len() < period {
        return result;
    }

    let mut average = values[..period].iter().sum::<f64>() / period as f64;
    result[period - 1] = Some(average);

    for index in period..values.len() {
        average = (average * (period as f64 - 1.0) + values[index]) / period as f64;
        result[index] = Some(average);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moving_average_uses_sliding_window() {
        let result = moving_average(&[1.0, 2.0, 3.0, 4.0], 3);

        assert_eq!(result, vec![None, None, Some(2.0), Some(3.0)]);
    }

    #[test]
    fn rsi_returns_values_after_period() {
        let result = relative_strength_index(&[1.0, 2.0, 1.5, 2.5, 3.0, 2.0], 3);

        assert!(result[0].is_none());
        assert!(result[3].is_some());
    }

    #[test]
    fn bollinger_bands_returns_mid_up_down() {
        let result = bollinger_bands(&[1.0, 2.0, 3.0, 4.0, 5.0], 3, 2.0);

        assert!(result[1].is_none());
        assert!(result[2].is_some());
    }

    #[test]
    fn supertrend_returns_values_after_atr_period() {
        let points: Vec<ChartPoint> = (0..20)
            .map(|index| ChartPoint {
                time: index,
                open: 10.0 + index as f64,
                high: 11.0 + index as f64,
                low: 9.0 + index as f64,
                close: 10.5 + index as f64,
                volume: 100.0,
            })
            .collect();
        let result = supertrend(&points, 10, 3.0);

        assert!(result[8].is_none());
        assert!(result[9].is_some());
    }
}
