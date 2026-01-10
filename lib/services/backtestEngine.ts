import { BacktestConfig, BacktestResult, Candle, EquityPoint, Strategy, Trade, ExitReason } from '@/lib/types';
import { buildIndicators, IndicatorMap, indicatorKey } from './indicatorEngine';
import { evalRules } from './strategyEngine';

function collectIndicatorSpecs(strategy: Strategy): { type: any; params: Record<string, any> }[] {
  const specs: { type: any; params: Record<string, any> }[] = [];
  const add = (type: any, params: any) => {
    specs.push({ type, params: params || {} });
  };
  const visitRule = (cond: any) => {
    add(cond.type, cond.params);
    if (cond.compareWith) add(cond.compareWith.type, cond.compareWith.params);
  };
  strategy.entry.all?.forEach(visitRule);
  strategy.entry.any?.forEach(visitRule);
  strategy.exit.all?.forEach(visitRule);
  strategy.exit.any?.forEach(visitRule);
  // de-duplicate
  const seen = new Set<string>();
  const out: { type: any; params: Record<string, any> }[] = [];
  for (const s of specs) {
    const key = `${s.type}_${JSON.stringify(s.params || {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function warmupBars(specs: { type: any; params: Record<string, any> }[]): number {
  let w = 0;
  for (const s of specs) {
    const p = Number(s.params?.period ?? 14);
    if (p > w) w = p;
  }
  return Math.max(20, w + 2); // ensure enough bars
}

export function backtest(candles: Candle[], cfg: BacktestConfig): BacktestResult {
  const capital0 = cfg.initialCapital ?? 10000;
  const commission = cfg.commission ?? 0.0005; // 0.05% per side
  const specs = collectIndicatorSpecs(cfg.strategy);
  const map: IndicatorMap = buildIndicators(candles, specs);

  const w = warmupBars(specs);
  let capital = capital0;
  let peak = capital0;

  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];

  let openTrade: Trade | null = null;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Update equity
    equity.push({ time: c.time, equity: capital, drawdown: Math.max(0, peak - capital) });
    if (capital > peak) peak = capital;

    if (i < w) continue; // not enough data

    if (!openTrade) {
      // Check entry
      const enter = evalRules(cfg.strategy.entry, map, i);
      if (enter) {
        const size = capital / c.close; // use full capital size
        const slPct = cfg.strategy.risk.stopLoss / 100;
        const tpPct = cfg.strategy.risk.takeProfit / 100;
        const stopLoss = c.close * (1 - slPct);
        const takeProfit = c.close * (1 + tpPct);

        openTrade = {
          id: `T${trades.length + 1}`,
          direction: 'long',
          entryTime: c.time,
          entryPrice: c.close,
          size,
          status: 'open',
          stopLoss,
          takeProfit,
        };
        // commission on entry
        capital -= capital * commission;
      }
      continue;
    }

    // Manage open trade (long-only MVP)
    const low = c.low;
    const high = c.high;

    let exit = false;
    let exitReason: ExitReason = 'exit_signal';
    let exitPrice = c.close;

    if (low <= openTrade.stopLoss) {
      exit = true;
      exitReason = 'stop_loss';
      exitPrice = openTrade.stopLoss;
    } else if (high >= openTrade.takeProfit) {
      exit = true;
      exitReason = 'take_profit';
      exitPrice = openTrade.takeProfit;
    } else {
      // exit rules at close
      const shouldExit = evalRules(cfg.strategy.exit, map, i);
      if (shouldExit) {
        exit = true;
        exitReason = 'exit_signal';
        exitPrice = c.close;
      }
    }

    if (exit) {
      const pnl = (exitPrice - openTrade.entryPrice) * openTrade.size;
      const pnlPct = (exitPrice - openTrade.entryPrice) / openTrade.entryPrice;

      capital += pnl;
      // commission on exit
      capital -= capital * commission;

      const closed: Trade = {
        ...openTrade,
        exitTime: c.time,
        exitPrice,
        status: 'closed',
        exitReason,
        pnl,
        pnlPercent: pnlPct * 100,
      };
      trades.push(closed);
      openTrade = null;

      if (capital > peak) peak = capital;
    }
  }

  // Final equity point
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    equity.push({ time: last.time, equity: capital, drawdown: Math.max(0, peak - capital) });
  }

  // Metrics
  const wins = trades.filter((t) => (t.pnl ?? 0) > 0);
  const losses = trades.filter((t) => (t.pnl ?? 0) <= 0);
  const totalPnL = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const finalCapital = capital;
  const totalPnLPercent = ((finalCapital - capital0) / capital0) * 100;

  const maxEquity = equity.reduce((m, e) => Math.max(m, e.equity), capital0);
  const minEquity = equity.reduce((m, e) => Math.min(m, e.equity), capital0);
  const maxDrawdown = maxEquity - minEquity;
  const maxDrawdownPercent = (maxDrawdown / maxEquity) * 100;

  const averageWin = wins.length ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  const averageLoss = losses.length ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;
  const largestWin = wins.length ? Math.max(...wins.map((t) => t.pnl ?? 0)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.pnl ?? 0)) : 0;

  return {
    metrics: {
      totalTrades: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      totalPnL,
      totalPnLPercent,
      maxDrawdown,
      maxDrawdownPercent: isFinite(maxDrawdownPercent) ? maxDrawdownPercent : 0,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      finalCapital,
    },
    trades,
    equityCurve: equity,
    candles,
    indicators: Object.values(map),
  };
}
