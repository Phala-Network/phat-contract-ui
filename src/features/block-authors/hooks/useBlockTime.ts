import { useMemo } from 'react';
import { BN, bnMin, bnToBn, BN_MAX_INTEGER, BN_ONE, extractTime } from '@polkadot/util';
import { useBlockInterval } from './useBlockInterval';

export const calcBlockTime = (blockTime: BN, blocks: BN) => {
  // in the case of excessively large locks, limit to the max JS integer value
  // 多个块预计的目标创建时间
  const value = bnMin(BN_MAX_INTEGER, blockTime.mul(blocks)).toNumber();

  // time calculations are using the absolute value (< 0 detection only on strings)
  // 转化成时间对象
  const time = extractTime(Math.abs(value));

  const { days, hours, minutes, seconds } = time;

  return [
    // 一个块的目标创建时间
    blockTime.toNumber(),
    // 为什么会小于 0？最终格式是 1day 1hr 1min
    `${value < 0 ? '+' : ''}${[
      days
        ? (days > 1)
          ? `${days} days`
          : '1 day'
        : null,
      hours
        ? (hours > 1)
          ? `${hours} hrs`
          : '1 hr'
        : null,
      minutes
        ? (minutes > 1)
          ? `${minutes} mins`
          : '1 min'
        : null,
      seconds
        ? (seconds > 1)
          ? `${seconds} s`
          : '1 s'
        : null
    ]
      .filter((s): s is string => !!s)
      .slice(0, 2)
      .join(' ')}`,
    // 时间对象也给返回了
    time
  ]
}

export const useBlockTime = (blocks: number | BN = BN_ONE) => {
  // 一个块预计的目标创建时间
  const blockTime = useBlockInterval();

  return useMemo(
    () => calcBlockTime(blockTime, bnToBn(blocks)),
    [blockTime, blocks]
  )
}