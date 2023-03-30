import type { Codec, AnyJson } from '@polkadot/types-codec/types'

import * as R from 'ramda'
import ms from 'ms'
import { ApiPromise } from "@polkadot/api"
import { ContractPromise } from "@polkadot/api-contract"
import { QueryFunctionContext } from "@tanstack/query-core"

import { CertificateData, create } from "@phala/sdk"
import { isClosedBetaEnv } from '@/vite-env'

function toHuman(value: Codec): AnyJson {
  return value.toHuman()
}

export function queryContractList(api: ApiPromise) {
  return {
    queryKey: ['phalaPhatContracts.contracts'],
    queryFn: async (ctx: any) => {
      const result = await api.query.phalaPhatContracts.contracts.entries()
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
    staleTime: ms('5m'),
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


async function createSystemContractPromise(api: ApiPromise, pruntime: string, contractId: string, remotePubkey: string) {
  return new ContractPromise(
    (await create({
      // @ts-ignore
      api: await ApiPromise.create({ ...api._options }),
      // api: await api.clone().isReady,
      baseURL: pruntime,
      contractId: contractId,
      remotePubkey: remotePubkey,
    })).api as unknown as ApiPromise,
    // contractSystem.metadata,
    {
      "V3": {
        "spec": {
          "messages": [
            {
              "args": [
                {
                  "label": "name",
                  "type": {
                    "displayName": [
                      "String"
                    ],
                    "type": 7
                  }
                }
              ],
              "docs": [],
              "label": "System::get_driver",
              "mutates": false,
              "payable": false,
              "returnType": {
                "displayName": [
                  "Option"
                ],
                "type": 12
              },
              "selector": "0x2740cf0a"
            },
          ],
        },
        "types": [
          {
            "id": 0,
            "type": {
              "def": {
                "composite": {
                  "fields": [
                    {
                      "type": 1,
                      "typeName": "u8"
                      // "typeName": "[u8; 32]"
                    }
                  ]
                }
              },
              "path": [
                "ink_env",
                "types",
                "AccountId"
              ]
            }
          },
          {
            "id": 1,
            "type": {
              "def": {
                "array": {
                  "len": 32,
                  "type": 2
                }
              }
            }
          },
          {
            "id": 2,
            "type": {
              "def": {
                "primitive": "u8"
              }
            }
          },
          {
            "id": 7,
            "type": {
              "def": {
                "primitive": "str"
              }
            }
          },
          {
            "id": 12,
            "type": {
              "def": {
                "variant": {
                  "variants": [
                    {
                      "index": 0,
                      "name": "None"
                    },
                    {
                      "fields": [
                        {
                          "type": 0
                        }
                      ],
                      "index": 1,
                      "name": "Some"
                    }
                  ]
                }
              },
              "params": [
                {
                  "name": "T",
                  "type": 0
                }
              ],
              "path": [
                "Option"
              ]
            }
          },
        ],
      }
    },
    contractId
  );
}

export function queryPinkLoggerContract(
  api: ApiPromise,
  pruntime: string,
  cert: CertificateData,
  systemContractId: string,
  remotePubkey: string
) {
  return {
    queryKey: ['pinkLoggerContract', pruntime, cert, systemContractId],
    queryFn: async () => {
      const systemContract = await createSystemContractPromise(
        api,
        pruntime,
        systemContractId,
        remotePubkey
      )
      const { output } = await systemContract.query['system::getDriver'](cert as unknown as string, {}, "PinkLogger")
      if (!output) {
        return null
      }
      const loggerContractId = output.toHex()
      if (!loggerContractId || loggerContractId === '0x') {
        return null
      }
      return await create({
        // api: await api.clone().isReady,
        // @ts-ignore
        api: await ApiPromise.create({ ...api._options }),
        baseURL: pruntime,
        contractId: loggerContractId,
        remotePubkey: remotePubkey,
      })
    },
    staleTime: ms('30m'),
  }
}
