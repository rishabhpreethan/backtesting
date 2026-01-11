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

  // LLM compile state
  const [strategyText, setStrategyText] = useState<string>("");
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiled, setCompiled] = useState<{
    strategy: Strategy | null;
    symbol?: string;
    timeframe?: string;
  }>({ strategy: null });

  async function runBacktest() {
    try {
      if (!compiled.strategy) {
        setError("Please compile a strategy first using the natural language input.");
        return;
      }
      setLoading(true);
      setError(null);
      setResult(null);
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      const effectiveSymbol = compiled.symbol || symbol;
      const effectiveInterval = compiled.timeframe || interval;
      const body: BacktestRequest = {
        symbol: effectiveSymbol,
        interval: effectiveInterval,
        startTime,
        endTime,
        strategy: compiled.strategy,
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
        </div>

        {/* LLM Strategy Compiler */}
        <div className="sm:col-span-2 grid gap-2">
          <span className="text-sm font-medium">Strategy (natural language)</span>
          <textarea
            rows={4}
            className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800"
            placeholder={"e.g. Buy when the 20 EMA crosses above the 50 EMA and RSI below 30. Exit when RSI above 70. SL 2%, TP 4%."}
            value={strategyText}
            onChange={(e) => setStrategyText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setCompileLoading(true);
                  setCompileError(null);
                  const res = await fetch('/api/strategy/compile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: strategyText }),
                  });
                  const json = await res.json();
                  if (!json.success) {
                    setCompiled({ strategy: null });
                    setCompileError(json.error || 'Failed to compile');
                  } else {
                    setCompiled({ strategy: json.data.strategy, symbol: json.data.symbol, timeframe: json.data.timeframe });
                  }
                } catch (e: any) {
                  setCompileError(e?.message || 'Failed to compile');
                } finally {
                  setCompileLoading(false);
                }
              }}
              className="px-3 py-2 rounded-md bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 disabled:opacity-50"
              disabled={compileLoading || !strategyText.trim()}
            >
              {compileLoading ? 'Compiling…' : 'Compile Strategy'}
            </button>
            {compiled.strategy && (
              <span className="text-xs text-green-600">Compiled ✓ {compiled.symbol ? `Symbol ${compiled.symbol}` : ''} {compiled.timeframe ? `· TF ${compiled.timeframe}` : ''}</span>
            )}
            {compileError && <span className="text-xs text-red-600">{compileError}</span>}
          </div>
        </div>
        <div className="sm:col-span-2">
          <button onClick={runBacktest} disabled={loading} className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black disabled:opacity-50">
            {loading ? "Running..." : "Run Backtest"}
          </button>
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
