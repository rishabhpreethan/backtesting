import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BacktestRequest, BacktestResponse } from '@/lib/types';
import { getCandles } from '@/lib/services/candleService';
import { backtest } from '@/lib/services/backtestEngine';

const BodySchema = z.object({
  symbol: z.string().min(1),
  interval: z.string().min(1),
  startTime: z.number().int().nonnegative(),
  endTime: z.number().int().nonnegative(),
  strategy: z.object({
    name: z.string().default('Strategy'),
    entry: z.object({
      all: z.array(z.any()).optional(),
      any: z.array(z.any()).optional(),
    }),
    exit: z.object({
      all: z.array(z.any()).optional(),
      any: z.array(z.any()).optional(),
    }),
    risk: z.object({
      stopLoss: z.number().positive(),
      takeProfit: z.number().positive(),
      trailingStop: z.number().optional(),
    }),
    direction: z.enum(['long', 'short', 'both']).optional(),
  }),
  initialCapital: z.number().positive().optional(),
  commission: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json) as BacktestRequest;

    if (body.startTime >= body.endTime) {
      return NextResponse.json<BacktestResponse>({ success: false, error: 'startTime must be < endTime' }, { status: 400 });
    }

    const candles = await getCandles({
      symbol: body.symbol,
      interval: body.interval,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    if (!candles.length) {
      return NextResponse.json<BacktestResponse>({ success: false, error: 'No candles returned for the given range' }, { status: 400 });
    }

    const result = backtest(candles, {
      symbol: body.symbol,
      interval: body.interval,
      startTime: body.startTime,
      endTime: body.endTime,
      strategy: body.strategy,
      initialCapital: body.initialCapital,
      commission: body.commission,
    });

    return NextResponse.json<BacktestResponse>({ success: true, data: result }, { status: 200 });
  } catch (err: any) {
    console.error('Backtest error', err?.message || err);
    return NextResponse.json<BacktestResponse>({ success: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
