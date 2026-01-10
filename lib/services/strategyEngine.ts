import { Candle, IndicatorCondition, StrategyRules } from '@/lib/types';
import { IndicatorMap, indicatorKey } from './indicatorEngine';

function getVal(map: IndicatorMap, type: any, params: any, idx: number): number | null {
  const key = indicatorKey(type, params || {});
  const series = map[key];
  if (!series) return null;
  return series.values[idx]?.value ?? null;
}

function crossedUp(aPrev: number | null, a: number | null, bPrev: number | null, b: number | null): boolean {
  if (aPrev == null || a == null || bPrev == null || b == null) return false;
  return aPrev <= bPrev && a > b;
}

function crossedDown(aPrev: number | null, a: number | null, bPrev: number | null, b: number | null): boolean {
  if (aPrev == null || a == null || bPrev == null || b == null) return false;
  return aPrev >= bPrev && a < b;
}

function evalCondition(
  cond: IndicatorCondition,
  map: IndicatorMap,
  idx: number,
): boolean {
  const left = getVal(map, cond.type as any, cond.params || {}, idx);
  const leftPrev = idx > 0 ? getVal(map, cond.type as any, cond.params || {}, idx - 1) : null;

  if (cond.compareWith) {
    const right = getVal(map, cond.compareWith.type as any, cond.compareWith.params || {}, idx);
    const rightPrev = idx > 0 ? getVal(map, cond.compareWith.type as any, cond.compareWith.params || {}, idx - 1) : null;

    switch (cond.op) {
      case 'cross_up':
        return crossedUp(leftPrev, left, rightPrev, right);
      case 'cross_down':
        return crossedDown(leftPrev, left, rightPrev, right);
      case '>':
        return left != null && right != null ? left > right : false;
      case '<':
        return left != null && right != null ? left < right : false;
      case '>=':
        return left != null && right != null ? left >= right : false;
      case '<=':
        return left != null && right != null ? left <= right : false;
      default:
        return false;
    }
  }

  // Compare to fixed value
  const value = cond.value ?? null;
  switch (cond.op) {
    case '>':
      return left != null && value != null ? left > value : false;
    case '<':
      return left != null && value != null ? left < value : false;
    case '>=':
      return left != null && value != null ? left >= value : false;
    case '<=':
      return left != null && value != null ? left <= value : false;
    default:
      return false;
  }
}

export function evalRules(rules: StrategyRules | undefined, map: IndicatorMap, idx: number): boolean {
  if (!rules) return false;
  const all = rules.all?.every((c) => evalCondition(c, map, idx)) ?? true;
  const anyList = rules.any ?? [];
  const any = anyList.length > 0 ? anyList.some((c) => evalCondition(c, map, idx)) : true;
  return all && any;
}
