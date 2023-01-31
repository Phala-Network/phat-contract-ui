import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { ApiPromise } from '@polkadot/api';
import { BN, bnMin, BN_MAX_INTEGER, BN_THOUSAND, BN_TWO, extractTime } from '@polkadot/util';
import { apiPromiseAtom } from '@/features/parachain/atoms';

const THRESHOLD = BN_THOUSAND.div(BN_TWO);
const DEFAULT_TIME = new BN(6_000);
const A_DAY = new BN(24 * 60 * 60 * 1000);
const calcTargetTime = (api: ApiPromise) => {
  return bnMin(
    A_DAY,
    (
      // Babe, e.g. Relay chains (Substrate defaults)
      api.consts.babe?.expectedBlockTime ||
      // POW, eg. Kulupu
      api.consts.difficulty?.targetBlockTime ||
      // Subspace
      api.consts.subspace?.expectedBlockTime || (
        // Check against threshold to determine value validity
        (api.consts.timestamp?.minimumPeriod).gte(THRESHOLD)
          // Default minimum period config
          ? (api.consts.timestamp.minimumPeriod).mul(BN_TWO)
          : api.query.parachainSystem
            // default guess for a parachain
            ? DEFAULT_TIME.mul(BN_TWO)
            // default guess for others
            : DEFAULT_TIME
    )
  ))
}

// convert block time to a string like '1 day', '2 days', '1 min' ...
const formatTargetTime = (blockTime: BN): string => {
  // in the case of excessively large locks, limit to the max JS integer value
  const value = bnMin(BN_MAX_INTEGER, blockTime).toNumber();

  // time calculations are using the absolute value (< 0 detection only on strings)
  const time = extractTime(Math.abs(value));

  const { days, hours, minutes, seconds } = time;
  
  // final format is 1day or 1hr or 1min
  return `${value < 0 ? '+' : ''}${[
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
      .join(' ')}`
}

// Target is a proper noun,
// it means the next block expect create time,
// learn more from https://cloudflare-ipfs.com/ipns/dotapps.io/#/explorer
export const useTarget = () => {
  const api = useAtomValue(apiPromiseAtom)

  const target = useMemo(
    () => {
      const time = calcTargetTime(api)
      const targetTime = formatTargetTime(time)
      return targetTime
    },
    [api]
  );

  return target
}