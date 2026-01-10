"use client";
import { useState } from "react";
import type { BacktestRequest, BacktestResponse, Strategy } from "@/lib/types";
import CandlestickChart from "@/components/CandlestickChart";
import EquityCurve from "@/components/EquityCurve";

export default function Home() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1h");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2024-02-01");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);

  const defaultStrategy: Strategy = {
    name: "SMA20/50 + RSI70 Exit",
    entry: {
      all: [
        { type: "SMA", params: { period: 20, source: "close" }, op: ">", compareWith: { type: "SMA", params: { period: 50, source: "close" } } },
      ],
    },
    exit: {
      any: [
        { type: "RSI", params: { period: 14 }, op: ">=", value: 70 },
      ],
    },
    risk: { stopLoss: 2, takeProfit: 4 },
    direction: "long",
  };

  async function runBacktest() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      const body: BacktestRequest = {
        symbol,
        interval,
        startTime,
        endTime,
        strategy: defaultStrategy,
        initialCapital: 10000,
        commission: 0.0005,
      };
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as BacktestResponse;
      setResult(json);
      if (!json.success) setError(json.error || "Unknown error");
    } catch (e: any) {
      setError(e?.message || "Failed to run backtest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">Binance Candlestick Backtesting (MVP)</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Symbol</span>
            <input className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Interval</span>
            <select className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" value={interval} onChange={(e) => setInterval(e.target.value)}>
              <option>1m</option>
              <option>5m</option>
              <option>15m</option>
              <option>1h</option>
              <option>4h</option>
              <option>1d</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Start</span>
            <input type="date" className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">End</span>
            <input type="date" className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <button onClick={runBacktest} disabled={loading} className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black disabled:opacity-50">
              {loading ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-600 dark:text-red-400">{error}</div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h2 className="font-medium mb-2">Metrics</h2>
              {result.success && result.data ? (
                <ul className="text-sm space-y-1">
                  <li>Total Trades: {result.data.metrics.totalTrades}</li>
                  <li>Win Rate: {result.data.metrics.winRate.toFixed(2)}%</li>
                  <li>Total PnL: {result.data.metrics.totalPnL.toFixed(2)}</li>
                  <li>Total PnL %: {result.data.metrics.totalPnLPercent.toFixed(2)}%</li>
                  <li>Max Drawdown %: {result.data.metrics.maxDrawdownPercent.toFixed(2)}%</li>
                  <li>Final Capital: {result.data.metrics.finalCapital.toFixed(2)}</li>
                </ul>
              ) : (
                <div className="text-sm text-zinc-500">No data</div>
              )}
            </div>

            {result.success && result.data && (
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h2 className="font-medium mb-3">Candles & Trades</h2>
                <CandlestickChart candles={result.data.candles} trades={result.data.trades} />
              </div>
            )}

            {result.success && result.data && (
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h2 className="font-medium mb-3">Equity Curve</h2>
                <EquityCurve data={result.data.equityCurve} />
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h2 className="font-medium mb-2">Sample Trades</h2>
              {result.success && result.data && result.data.trades.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {result.data.trades.slice(0, 10).map((t) => (
                    <li key={t.id} className="flex justify-between">
                      <span>{t.id} · {new Date(t.entryTime).toLocaleString()} → {t.exitTime ? new Date(t.exitTime).toLocaleString() : '-'}</span>
                      <span className={((t.pnl ?? 0) >= 0) ? 'text-green-600' : 'text-red-600'}>
                        {(t.pnl ?? 0).toFixed(2)} ({(t.pnlPercent ?? 0).toFixed(2)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-zinc-500">No trades</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
