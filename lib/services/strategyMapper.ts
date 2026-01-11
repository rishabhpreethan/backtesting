import { Strategy } from '@/lib/types';
import { StrategyJson } from './strategySchema';

// Map LLM JSON schema to internal Strategy schema
export function mapStrategyJsonToInternal(s: StrategyJson): Strategy {
  const mapCondition = (c: any) => {
    const left = c.left;
    const right = c.right;
    const opMap: Record<string, any> = {
      '>': '>',
      '<': '<',
      cross_above: 'cross_up',
      cross_below: 'cross_down',
    };

    const cond: any = {
      type: left.indicator,
      params: { period: left.period, source: 'close' },
      op: opMap[c.operator],
    };

    if (right) {
      cond.compareWith = {
        type: right.indicator,
        params: { period: right.period, source: 'close' },
      };
    }
    if (c.value !== undefined) {
      cond.value = Number(c.value);
    }
    return cond;
  };

  const entry = {
    all: s.entry.all?.map(mapCondition),
    any: s.entry.any?.map(mapCondition),
  };
  const exit = {
    all: s.exit.all?.map(mapCondition),
    any: s.exit.any?.map(mapCondition),
  };

  const strategy: Strategy = {
    name: 'LLM Strategy',
    entry,
    exit,
    risk: {
      stopLoss: s.risk.stopLossPct,
      takeProfit: s.risk.takeProfitPct,
    },
    direction: 'long',
  };

  return strategy;
}
