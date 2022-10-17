import type { ApiPromise } from "@polkadot/api"
import type { QueryFunctionContext } from "@tanstack/query-core"
import type { Codec, AnyJson } from '@polkadot/types-codec/types'

import * as R from 'ramda'

function toHuman(value: Codec): AnyJson {
  return value.toHuman()
}

export function queryContractList(api: ApiPromise) {
  return {
    queryKey: ['phalaFatContracts.contracts'],
    queryFn: async (ctx: any) => {
      const result = await api.query.phalaFatContracts.contracts.entries()
      const transformed: Pairs<string, ContractInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.toHuman() as string[]
        return [keys[0], value.unwrap().toHuman()]
      })
      return R.fromPairs(transformed)
    },
    refetchInterval: 1000 * 60 * 15, // every 15 minutes
    refetchIntervalInBackground: true,
  }
}

export function queryClusterList(api: ApiPromise) {
  return {
    queryKey: ['phalaFatContracts.clusters'],
    queryFn: async () => {
      const result = await api.query.phalaFatContracts.clusters.entries()
      const transformed: Pairs<string, ClusterInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.toHuman() as string[]
        return [keys[0], value.unwrap().toHuman()]
      })
      return transformed
    }
  }
}