import { Candle, IndicatorResult, IndicatorType, IndicatorValue } from '@/lib/types';

function seriesFrom(candles: Candle[], field: keyof Candle): number[] {
  return candles.map((c) => Number(c[field]));
}

// Stream MACD calculator to avoid double-null handling
function macd(values: number[], fast: number, slow: number, signal: number) {
  const macdLine: (number | null)[] = new Array(values.length).fill(null);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  const histLine: (number | null)[] = new Array(values.length).fill(null);

  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSignal = 2 / (signal + 1);

  let emaFast: number | null = null;
  let emaSlow: number | null = null;
  let emaSignal: number | null = null;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];

    // EMA fast
    if (emaFast == null) emaFast = v; else emaFast = v * kFast + emaFast * (1 - kFast);
    // EMA slow
    if (emaSlow == null) emaSlow = v; else emaSlow = v * kSlow + emaSlow * (1 - kSlow);

    // Warmup conditions: expose macd only after both EMAs have sufficient bars
    const minWarmup = Math.max(fast, slow) - 1;
    if (i >= minWarmup) {
      const macdVal = emaFast - emaSlow;
      macdLine[i] = macdVal;

      // Signal EMA on macd
      if (emaSignal == null) {
        // initialize when first macd value appears
        emaSignal = macdVal;
      } else {
        emaSignal = macdVal * kSignal + emaSignal * (1 - kSignal);
      }

      // Expose signal after warmup
      if (i >= minWarmup + signal - 1) {
        signalLine[i] = emaSignal;
        histLine[i] = macdVal - emaSignal;
      }
    }
  }

  return { macdLine, signalLine, histLine };
}

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i === 0) {
      prev = v;
      out[i] = null; // warmup
    } else if (prev == null) {
      prev = v;
      out[i] = null;
    } else {
      prev = v * k + prev * (1 - k);
      if (i >= period - 1) out[i] = prev;
    }
  }
  return out;
}

function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      }
      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function toIndicatorValues(times: number[], vals: (number | null)[]): IndicatorValue[] {
  return times.map((t, i) => ({ time: t, value: vals[i] ?? null }));
}

function keyFrom(type: IndicatorType, params: Record<string, any>): string {
  const p = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('_');
  return `${type}_${p}`;
}

export type IndicatorMap = Record<string, IndicatorResult>;

export function buildIndicators(
  candles: Candle[],
  specList: { type: IndicatorType; params: Record<string, any> }[],
): IndicatorMap {
  const times = candles.map((c) => c.time);
  const close = seriesFrom(candles, 'close');

  const out: IndicatorMap = {};
  for (const { type, params } of specList) {
    const key = keyFrom(type, params);
    if (out[key]) continue;

    let values: (number | null)[];
    if (type === 'SMA') {
      const period = Number(params.period ?? 14);
      const src = String(params.source ?? 'close') as keyof Candle;
      values = sma(seriesFrom(candles, src), period);
    } else if (type === 'EMA') {
      const period = Number(params.period ?? 14);
      const src = String(params.source ?? 'close') as keyof Candle;
      values = ema(seriesFrom(candles, src), period);
    } else if (type === 'RSI') {
      const period = Number(params.period ?? 14);
      values = rsi(close, period);
    } else if (type === 'MACD') {
      const fast = Number(params.fast ?? 12);
      const slow = Number(params.slow ?? 26);
      const signal = Number(params.signal ?? 9);
      const component = String(params.component ?? 'line'); // 'line' | 'signal' | 'hist'
      const { macdLine, signalLine, histLine } = macd(close, fast, slow, signal);
      if (component === 'signal') values = signalLine;
      else if (component === 'hist') values = histLine;
      else values = macdLine;
    } else {
      throw new Error(`Unsupported indicator: ${type}`);
    }

    out[key] = {
      type,
      values: toIndicatorValues(times, values),
      params,
      key,
    };
  }
  return out;
}

export function indicatorKey(type: IndicatorType, params: Record<string, any>): string {
  return keyFrom(type, params);
}
