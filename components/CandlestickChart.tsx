"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, type UTCTimestamp, type SeriesMarkerPosition, type SeriesMarkerShape, LineStyle } from "lightweight-charts";
import type { Candle, Trade } from "@/lib/types";

interface TooltipProps {
  trade: Trade;
  visible: boolean;
  x: number;
  y: number;
}

export default function CandlestickChart({ candles, trades }: { candles: Candle[]; trades: Trade[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any | null>(null);
  const [tooltip, setTooltip] = useState<TooltipProps | null>(null);
  
  // Map to store trade by time for tooltip lookup
  const tradeMap = useRef<Map<number, Trade>>(new Map());

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;

    // Clean up any existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    
    // Build trade map for tooltip lookup
    tradeMap.current.clear();
    trades.forEach(trade => {
      tradeMap.current.set(Math.floor(trade.entryTime / 1000), trade);
      if (trade.exitTime) {
        tradeMap.current.set(Math.floor(trade.exitTime / 1000), trade);
      }
    });

    // Get dark mode preference from system
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Create chart with v3.8.0 API
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        backgroundColor: prefersDarkMode ? "#131722" : "#ffffff",
        textColor: prefersDarkMode ? "#d1d4dc" : "#333333",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: prefersDarkMode ? "#1f2937" : "#f0f0f0", style: 0 },
        horzLines: { color: prefersDarkMode ? "#1f2937" : "#f0f0f0", style: 0 },
      },
      timeScale: {
        borderColor: prefersDarkMode ? "#2b2b43" : "#d1d4dc",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0');
        },
      },
      rightPriceScale: {
        borderColor: prefersDarkMode ? "#2b2b43" : "#d1d4dc",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      crosshair: {
        vertLine: {
          color: prefersDarkMode ? "#758696" : "#758696",
          width: 1,
          style: 1,
        },
        horzLine: {
          color: prefersDarkMode ? "#758696" : "#758696",
          width: 1,
          style: 1,
        },
      },
    });
    
    // IMPORTANT: Add candlestick series FIRST before any other series
    // to ensure it's rendered at the bottom layer
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      }
    });

    // Format data for the chart
    const formattedData = candles.map(c => ({
      time: Math.floor(c.time / 1000) as UTCTimestamp, // Convert ms to seconds for v3
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    
    // Helper: nearest candle index for a given time to constrain overlays
    const times = formattedData.map(d => d.time);
    const nearestIndex = (ts: UTCTimestamp) => {
      let lo = 0, hi = times.length - 1, ans = times.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((times[mid] as number) >= (ts as number)) { ans = mid; hi = mid - 1; }
        else { lo = mid + 1; }
      }
      return ans;
    };

    // Set the data and ensure it's visible
    candleSeries.setData(formattedData);
    
    // Set a reasonable zoom level instead of fitting all content
    // This ensures candles are visible at a good size
    if (formattedData.length > 0) {
      // Calculate a reasonable visible range (show ~30-50 candles)
      const visibleBars = Math.min(50, formattedData.length);
      const lastIndex = formattedData.length - 1;
      const firstVisibleIndex = Math.max(0, lastIndex - visibleBars);
      
      // Set visible range to the last N candles
      chart.timeScale().setVisibleRange({
        from: formattedData[firstVisibleIndex].time,
        to: formattedData[lastIndex].time,
      });
      
      // Set proper bar spacing for good visibility
      chart.timeScale().applyOptions({
        barSpacing: 10, // Reasonable spacing between bars
      });
    }

    // Create position boxes for each trade
    if (trades.length > 0) {
      // Collect small entry/exit markers across all trades
      const markers: { time: UTCTimestamp; position: SeriesMarkerPosition; color: string; shape: SeriesMarkerShape }[] = [];
      for (const trade of trades) {
        const entryTime = Math.floor(trade.entryTime / 1000) as UTCTimestamp;
        
        // For completed trades, use actual entry and exit times
        // For open trades, show a reasonable window
        let startTime = entryTime;
        let endTime: UTCTimestamp;
        
        if (trade.exitTime) {
          // Use actual trade duration for completed trades
          endTime = Math.floor(trade.exitTime / 1000) as UTCTimestamp;
        } else {
          // For open trades, show a reasonable window
          const entryIdx = nearestIndex(entryTime);
          const endIdx = Math.min(formattedData.length - 1, entryIdx + 20);
          endTime = times[endIdx] as UTCTimestamp;
        }
        
        // Add entry marker (vertical line at entry candle)
        const entryMarkerSeries = chart.addLineSeries({
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          lineWidth: 2,
          color: '#2962FF',
          lineStyle: LineStyle.Dashed,
          title: `${trade.id} Entry`,
          priceScaleId: '',
        });
        entryMarkerSeries.setData([
          { time: entryTime, value: trade.entryPrice - 1e-8 },
          { time: entryTime, value: trade.entryPrice + 1e-8 },
        ]);

        // Small exit marker (if trade is closed)
        if (trade.exitTime && trade.exitPrice) {
          markers.push({
            time: Math.floor(trade.exitTime / 1000) as UTCTimestamp,
            position: "aboveBar" as SeriesMarkerPosition,
            color: "#f23645",
            shape: "circle" as SeriesMarkerShape,
            // Size is not supported in this version, use minimal marker
          });
        }
      }

      candleSeries.setMarkers(markers);
    }

    // Setup tooltip handling
    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      
      const time = param.time as number;
      const trade = tradeMap.current.get(time);
      
      if (trade) {
        setTooltip({
          trade,
          visible: true,
          x: param.point.x,
          y: param.point.y,
        });
      } else {
        setTooltip(null);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chart) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    
    // Store reference and return cleanup
    chartRef.current = chart;
    
    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles, trades]);

  // Format trade metrics for tooltip
  const formatTradeMetrics = (trade: Trade) => {
    const riskReward = trade.takeProfit / trade.stopLoss;
    const pnlFormatted = trade.pnl ? `${trade.pnl.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)` : 'N/A';
    const exitReason = trade.exitReason ? trade.exitReason.replace('_', ' ') : 'N/A';
    
    // Calculate trade duration for completed trades
    let duration = '';
    if (trade.entryTime && trade.exitTime) {
      const durationMs = trade.exitTime - trade.entryTime;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      duration = `Duration: ${hours}h ${minutes}m`;
    }
    
    return {
      id: trade.id,
      direction: trade.direction,
      entry: `Entry: ${new Date(trade.entryTime).toLocaleString()} @ ${trade.entryPrice.toFixed(2)}`,
      exit: trade.exitTime ? `Exit: ${new Date(trade.exitTime).toLocaleString()} @ ${trade.exitPrice?.toFixed(2)}` : 'Active',
      pnl: `P/L: ${pnlFormatted}`,
      riskReward: `Risk/Reward: 1:${riskReward.toFixed(2)}`,
      stopLoss: `SL: ${(trade.entryPrice * (trade.direction === 'long' ? (1 - trade.stopLoss/100) : (1 + trade.stopLoss/100))).toFixed(2)} (${trade.stopLoss}%)`,
      takeProfit: `TP: ${(trade.entryPrice * (trade.direction === 'long' ? (1 + trade.takeProfit/100) : (1 - trade.takeProfit/100))).toFixed(2)} (${trade.takeProfit}%)`,
      exitReason: `Exit Reason: ${exitReason}`,
      duration: duration,
    };
  };

  return (
    <div className="w-full relative">
      <div ref={containerRef} className="w-full" />
      
      {tooltip && tooltip.visible && (
        <div 
          className="absolute bg-white dark:bg-zinc-800 p-3 rounded shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs z-10"
          style={{
            left: tooltip.x + 20,
            top: tooltip.y - 10,
            maxWidth: '250px',
          }}
        >
          {(() => {
            const metrics = formatTradeMetrics(tooltip.trade);
            return (
              <div className="space-y-1">
                <div className="font-bold text-sm flex items-center gap-2">
                  <span className={metrics.direction === 'long' ? 'text-green-600' : 'text-red-600'}>
                    Trade {metrics.id} ({metrics.direction.toUpperCase()})
                  </span>
                </div>
                <div>{metrics.entry}</div>
                <div>{metrics.exit}</div>
                <div className={tooltip.trade.pnl && tooltip.trade.pnl > 0 ? 'text-green-600' : 'text-red-600'}>
                  {metrics.pnl}
                </div>
                {metrics.duration && <div>{metrics.duration}</div>}
                <div>{metrics.riskReward}</div>
                <div>{metrics.stopLoss}</div>
                <div>{metrics.takeProfit}</div>
                <div>{metrics.exitReason}</div>
              </div>
            );
          })()} 
        </div>
      )}
    </div>
  );
}
