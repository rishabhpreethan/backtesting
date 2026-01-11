import { z } from 'zod';

export const IndicatorEnum = z.enum(['SMA', 'EMA', 'RSI']);
export const OperatorEnum = z.enum(['>', '<', 'cross_above', 'cross_below']);

const IndicatorOperand = z.object({
  indicator: IndicatorEnum,
  period: z.number().int().positive().max(500),
});

const EntryExitCondition = z.object({
  left: IndicatorOperand,
  operator: OperatorEnum,
  right: z.union([IndicatorOperand, z.undefined()]).optional(),
  value: z.union([z.number(), z.undefined()]).optional(),
}).refine((c) => {
  // If operator is comparison, require value or right
  if (c.operator === '>' || c.operator === '<') {
    return (c.value !== undefined) || (c.right !== undefined);
  }
  // If operator is cross, require right indicator
  if (c.operator === 'cross_above' || c.operator === 'cross_below') {
    return !!c.right && !c.value;
  }
  return true;
}, { message: 'Invalid condition structure' });

export const StrategyJsonSchema = z.object({
  symbol: z.string().default('BTCUSDT'),
  timeframe: z.string().default('1h'),
  entry: z.object({
    all: z.array(EntryExitCondition).optional(),
    any: z.array(EntryExitCondition).optional(),
  }),
  exit: z.object({
    all: z.array(EntryExitCondition).optional(),
    any: z.array(EntryExitCondition).optional(),
  }),
  risk: z.object({
    stopLossPct: z.number().nonnegative().max(100),
    takeProfitPct: z.number().nonnegative().max(100),
  }),
});

export type StrategyJson = z.infer<typeof StrategyJsonSchema>;
