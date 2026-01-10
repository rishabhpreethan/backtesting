# Binance Candlestick Backtesting App

A Next.js application for backtesting trading strategies using historical candlestick data from Binance.

## Features

- Fetch historical candlestick data from Binance API
- Implement technical indicators (SMA, EMA, RSI)
- Define rules-based trading strategies
- Backtest strategies with proper trade tracking
- Visualize results with candlestick charts and position boxes
- View trade metrics and equity curves

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Binance API key (optional, but recommended)

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your Binance API credentials:

```
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_BASE_URL=https://api.binance.com
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter a symbol (e.g., BTCUSDT)
2. Select a timeframe (1m, 5m, 15m, 1h, 4h, 1d)
3. Choose a date range
4. Click "Run Backtest"
5. View results including:
   - Trade metrics (win rate, P&L, etc.)
   - Candlestick chart with position boxes
   - Hover over position boxes to see detailed trade information
   - Equity curve showing account balance over time

## Architecture

- `/lib/types`: TypeScript interfaces for the entire system
- `/lib/services/candleService.ts`: Binance API integration with pagination
- `/lib/services/indicatorEngine.ts`: Technical indicator calculations
- `/lib/services/strategyEngine.ts`: Rules-based strategy evaluation
- `/lib/services/backtestEngine.ts`: Core backtesting logic
- `/app/api/backtest/route.ts`: API endpoint for running backtests
- `/components`: React UI components including charts

## Default Strategy

The default strategy uses:
- Entry: SMA(20) > SMA(50)
- Exit: RSI(14) >= 70
- Risk management: 2% stop loss, 4% take profit

## License

MIT
