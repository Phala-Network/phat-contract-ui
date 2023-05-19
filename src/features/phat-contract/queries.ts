import * as R from 'ramda'
import ms from 'ms'
import { ApiPromise } from "@polkadot/api"
import { QueryFunctionContext } from "@tanstack/query-core"


export function queryClusterList(api: ApiPromise) {
  return {
    queryKey: ['phalaPhatContracts.clusters'],
    queryFn: async () => {
      const result = await api.query.phalaPhatContracts.clusters.entries()
      const transformed: Pairs<string, ClusterInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.args.map(i => i.toPrimitive()) as string[]
        const info = value.unwrap().toJSON()
        info.id = keys[0]
        return [keys[0], info]
      })
      return transformed
    },
  }
}

export function queryClusterWorkerPublicKey(api: ApiPromise, clusterId?: string) {
  return {
    queryKey: ['phalaPhatContracts.clusterWorkers', clusterId],
    queryFn: async (ctx: any) => {
      const { queryKey: [, clusterId ]} = ctx as QueryFunctionContext<[string, string]>
      if (clusterId) {
        const result = await api.query.phalaPhatContracts.clusterWorkers(clusterId)
        return [[clusterId, result.toHuman()]]
      } else {
        const result = await api.query.phalaPhatContracts.clusterWorkers.entries()
        const transformed = result.map(([storageKey, value]) => {
          const keys = storageKey.toHuman() as string[]
          return [keys[0], value.toHuman()]
        })
        return transformed
      }
    },
    staleTime: ms('30m'),
  }
}

export function queryEndpointList(api: ApiPromise, workerId?: string) {
  return {
    queryKey: ['phalaPhatContracts.endpoints', workerId],
    queryFn: async (ctx: QueryFunctionContext) => {
      const { queryKey: [, workerId ]} = ctx as QueryFunctionContext<[string, string]>
      const result = await api.query.phalaRegistry.endpoints.entries()
      const transformed: Pairs<string, EndpointInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.toHuman() as string[]
        return [keys[0], value.unwrap().toHuman()]
      })
      if (workerId) {
        return R.filter(i =>i[0] === workerId, transformed)
      }
      return transformed
    },
    staleTime: ms('5m'),
  }
}
