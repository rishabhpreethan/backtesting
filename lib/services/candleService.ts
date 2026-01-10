import axios from 'axios';
import { Candle, RawKline } from '@/lib/types';

const BASE_URL = process.env.BINANCE_BASE_URL || 'https://api.binance.com';
const API_KEY = process.env.BINANCE_API_KEY;

function mapKline(k: RawKline): Candle {
  const [openTime, open, high, low, close, volume, closeTime] = [
    k[0], k[1], k[2], k[3], k[4], k[5], k[6],
  ];
  return {
    time: Number(closeTime),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume),
  };
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export interface GetCandlesParams {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  limit?: number; // default 1000
  throttleMs?: number; // default 250ms
}

export async function getCandles({
  symbol,
  interval,
  startTime,
  endTime,
  limit = 1000,
  throttleMs = 200,
}: GetCandlesParams): Promise<Candle[]> {
  const out: Candle[] = [];
  let from = startTime;

  while (true) {
    const params = {
      symbol,
      interval,
      startTime: from,
      endTime,
      limit,
    } as Record<string, any>;

    const res = await axios.get<RawKline[]>(`${BASE_URL}/api/v3/klines`, {
      params,
      headers: API_KEY ? { 'X-MBX-APIKEY': API_KEY } : undefined,
      timeout: 30000,
    });

    const klines = res.data;
    if (!klines || klines.length === 0) break;

    for (const k of klines) {
      const candle = mapKline(k);
      if (candle.time > endTime) break;
      out.push(candle);
    }

    const last = klines[klines.length - 1];
    const lastCloseTime = Number(last[6]);

    if (lastCloseTime >= endTime || klines.length < limit) break;

    from = lastCloseTime + 1;
    if (throttleMs > 0) await sleep(throttleMs);
  }

  // Ensure sorted and unique
  out.sort((a, b) => a.time - b.time);
  const deduped: Candle[] = [];
  let prev: number | null = null;
  for (const c of out) {
    if (c.time !== prev) deduped.push(c);
    prev = c.time;
  }
  return deduped;
}
