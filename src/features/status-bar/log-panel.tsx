import {Bytes} from '@polkadot/types-codec'

import React, { useCallback } from 'react'
import tw from 'twin.macro'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { Badge, Button } from '@chakra-ui/react'
import { TiInfoOutline } from 'react-icons/ti'
import { web3FromSource } from '@polkadot/extension-dapp'
import { ContractPromise } from '@polkadot/api-contract'
import { hexToString } from '@polkadot/util'
import * as R from 'ramda'

import { create, signCertificate } from '../../sdk'
import { pruntimeURLAtom, rpcApiInstanceAtom } from '@/features/chain/atoms'
import { lastSelectedAccountAtom } from '@/features/account/atoms'
import { clusterIdAtom } from '../instantiate/atoms'

interface ClusterQueryResult {
  systemContract: string
}

const logsAtom = atom<string[]>([])

const useFetchPinkLog = () => {
  const api = useAtomValue(rpcApiInstanceAtom)
  const account = useAtomValue(lastSelectedAccountAtom)
  const pruntimeURL = useAtomValue(pruntimeURLAtom)
  const clusterId = useAtomValue(clusterIdAtom)
  const setLogs = useSetAtom(logsAtom)
  return useCallback(async () => {
    if (!api || !account || !pruntimeURL) {
      return
    }
    const { signer } = await web3FromSource(account.meta.source)
    const cert = await signCertificate({ signer, account, api })

    const info = (await api.query.phalaFatContracts.clusters(clusterId)).toJSON() as unknown as ClusterQueryResult
    console.log('cluster info', info)

    const system = new ContractPromise(
        (await create({
          api: await api.clone().isReady,
          baseURL: pruntimeURL,
          contractId: info.systemContract,
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
        info.systemContract
    );
    const { output } = await system.query['system::getDriver'](cert as unknown as string, {}, "PinkLogger");
    console.log('output: ', output?.toHex())

    // const pruntimeURL = 'http://192.168.50.2:8000';
    console.log('pruntimeURL for fetch pink log', pruntimeURL)
    const { sidevmQuery } = await create({
      api: await api.clone().isReady,
      baseURL: pruntimeURL,
      contractId: output?.toHex()!,
    })

    const raw = await sidevmQuery('' as unknown as Bytes, cert)
    // const bytes = api.createType('Bytes', '')
    // const raw = await sidevmQuery(bytes, cert)
    // console.log('raw', raw)
    const resp = api.createType('InkResponse', raw)
    // @ts-ignore
    const result = resp.result.toHuman()
    // console.log(result)
    setLogs(hexToString(result.Ok.InkMessageReturn).split('\n'))
    // const text = api.createType('Vec<u8>', result.Ok.InkMessageReturn)
    // console.log(text.toString())
  }, [api, account, pruntimeURL, clusterId, setLogs])
}

const ReloadButton = () => {
  const fetch = useFetchPinkLog()
  return (
    <Button onClick={fetch}>Fetch Log</Button>
  )
}

const Logs = () => {
  const logs = useAtomValue(logsAtom)
  return (
    <div tw="flex flex-col gap-2 my-4">
      {logs.map((log, i) => (
        <div key={i} tw="font-mono text-sm">{log}</div>
      ))}
    </div>
  )
}

export default function LogPanel() {
  return (
    <div tw="overflow-y-scroll h-[26vh] px-6">
      <ReloadButton />
      <Logs />
    </div>
  )
}