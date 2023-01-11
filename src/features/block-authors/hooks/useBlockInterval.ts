import { useMemo } from 'react';
import { useAtomValue } from 'jotai'
import { ApiPromise } from '@polkadot/api';
import { BN, BN_THOUSAND, BN_TWO, bnMin } from '@polkadot/util';
import { apiPromiseAtom } from '@/features/parachain/atoms'

// Some chains incorrectly use these, i.e. it is set to values such as 0 or even 2
// Use a low minimum validity threshold to check these against
const THRESHOLD = BN_THOUSAND.div(BN_TWO);
const DEFAULT_TIME = new BN(6_000);

export const A_DAY = new BN(24 * 60 * 60 * 1000);

export const calcInterval = (api: any) => {
  // console.log('api.consts', api.consts)
  // 取最小的 big number
  return bnMin(
    // 一天的时间
    A_DAY,
    (
    // Babe, e.g. Relay chains (Substrate defaults)
    api.consts.babe?.expectedBlockTime ||
    // POW, eg. Kulupu
    api.consts.difficulty?.targetBlockTime ||
    // Subspace
    api.consts.subspace?.expectedBlockTime || (
      // Check against threshold to determine value validity
      api.consts.timestamp?.minimumPeriod.gte(THRESHOLD)
        // Default minimum period config
        ? api.consts.timestamp.minimumPeriod.mul(BN_TWO)
        : api.query.parachainSystem
          // default guess for a parachain
          ? DEFAULT_TIME.mul(BN_TWO)
          // default guess for others
          : DEFAULT_TIME
    )
  ))
}

export const useBlockInterval = () => {
  const api = useAtomValue(apiPromiseAtom)

  return useMemo(
    () => calcInterval(api),
    [api]
  );
}