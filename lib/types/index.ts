// Core data structures
export interface Candle {
  time: number; // closeTime in UTC milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type RawKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

// Indicator types
export type IndicatorType = 'SMA' | 'EMA' | 'RSI';

export interface IndicatorValue {
  time: number;
  value: number | null;
}

export interface IndicatorResult {
  type: IndicatorType;
  values: IndicatorValue[];
  params: Record<string, any>;
  key: string; // unique key like SMA_20_close
}

// Strategy condition types
export type ConditionOperator =
  | 'cross_up'
  | 'cross_down'
  | '>'
  | '<'
  | '>='
  | '<=';

export interface IndicatorCondition {
  type: IndicatorType;
  params?: Record<string, any>;
  op: ConditionOperator;
  value?: number; // for numeric compares
  compareWith?: {
    type: IndicatorType;
    params?: Record<string, any>;
  };
}

export interface StrategyRules {
  all?: IndicatorCondition[]; // AND logic
  any?: IndicatorCondition[]; // OR logic
}

export interface RiskManagement {
  stopLoss: number; // percentage
  takeProfit: number; // percentage
  trailingStop?: number; // percentage (optional MVP ignored)
}

export interface Strategy {
  name: string;
  entry: StrategyRules;
  exit: StrategyRules;
  risk: RiskManagement;
  direction?: 'long' | 'short' | 'both';
}

// Trade tracking
export type TradeStatus = 'open' | 'closed';
export type TradeDirection = 'long' | 'short';
export type ExitReason = 'stop_loss' | 'take_profit' | 'exit_signal';

export interface Trade {
  id: string;
  direction: TradeDirection;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  size: number; // position size in units (we use capital/value sizing)
  status: TradeStatus;
  exitReason?: ExitReason;
  pnl?: number;
  pnlPercent?: number;
  stopLoss: number;
  takeProfit: number;
}

// Backtest configuration
export interface BacktestConfig {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  strategy: Strategy;
  initialCapital?: number; // default 10000
  commission?: number; // percentage per side, default 0.05% = 0.0005
}

// Backtest results
export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  finalCapital: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number; // absolute drawdown from peak
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  candles: Candle[];
  indicators?: IndicatorResult[];
}

// API request/response types
export interface BacktestRequest {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  strategy: Strategy;
  initialCapital?: number;
  commission?: number;
}

export interface BacktestResponse {
  success: boolean;
  data?: BacktestResult;
  error?: string;
}
