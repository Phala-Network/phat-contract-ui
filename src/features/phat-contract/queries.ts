import type { ApiPromise } from "@polkadot/api"
import type { Codec, AnyJson } from '@polkadot/types-codec/types'

import * as R from 'ramda'
import { CertificateData, create } from "../../sdk"
import { ContractPromise } from "@polkadot/api-contract"

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

export function queryEndpointList(api: ApiPromise, workerId?: string) {
  return {
    queryKey: ['phalaFatContracts.endpoints', workerId],
    queryFn: async () => {
      const result = await api.query.phalaRegistry.endpoints.entries()
      const transformed: Pairs<string, EndpointInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.toHuman() as string[]
        return [keys[0], value.unwrap().toHuman()]
      })
      return transformed
    }
  }
}


async function createSystemContractPromise(api: ApiPromise, pruntime: string, contractId: string) {
  return new ContractPromise(
    (await create({
      api: await api.clone().isReady,
      baseURL: pruntime,
      contractId: contractId,
    })).api,
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
  systemContractId: string
) {
  return {
    queryKey: ['pinkLoggerContract', pruntime, cert, systemContractId],
    queryFn: async () => {
      const systemContract = await createSystemContractPromise(
        await api.clone().isReady,
        pruntime,
        systemContractId
      )
      const { output } = await systemContract.query['system::getDriver'](cert as unknown as string, {}, "PinkLogger")
      if (!output) {
        return null
      }
      const loggerContractId = output.toHex()
      if (!loggerContractId) {
        return null
      }
      return await create({
        api: await api.clone().isReady,
        baseURL: pruntime,
        contractId: loggerContractId,
      })
    },
  }
}