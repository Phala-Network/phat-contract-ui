import type { ApiPromise } from "@polkadot/api"

import { useState, useCallback } from "react"
import { useAtomValue, useSetAtom } from 'jotai'
import { ContractPromise } from "@polkadot/api-contract"
import { queryClientAtom } from "jotai/query"

import { create } from '../../../sdk'
import { apiPromiseAtom } from "@/features/parachain/atoms"
import {
  pruntimeURLAtom,
  currentSystemContractIdAtom,
  currentSystemContractInstanceAtom,
  pinkLoggerEnabledAtom,
  pinkLoggerContractIdAtom,
} from "../atoms"
import { querySignCertificate } from "@/features/identity/queries"
import { currentAccountAtom, signerAtom } from "@/features/identity/atoms"

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

export default function useCheckPinkLogger() {
  const [isChecking, setIsChecking] = useState(false)
  const api = useAtomValue(apiPromiseAtom)
  const pruntime = useAtomValue(pruntimeURLAtom)
  const systemContractId = useAtomValue(currentSystemContractIdAtom)
  const setSystemContractInstance = useSetAtom(currentSystemContractInstanceAtom)
  const setPinkLoggerContractId = useSetAtom(pinkLoggerContractIdAtom)
  const setPinkLoggerEnabled = useSetAtom(pinkLoggerEnabledAtom)
  const queryClient = useAtomValue(queryClientAtom)
  const signer = useAtomValue(signerAtom)
  const account = useAtomValue(currentAccountAtom)
  const checkPinkLogger = useCallback(async () => {
    try {
      setIsChecking(true)
      if (!systemContractId || !signer || !account) {
        return null
      }
      const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account))
      const systemContract = await createSystemContractPromise(api, pruntime, systemContractId)
      setSystemContractInstance(systemContract)
      const { output } = await systemContract.query['system::getDriver'](cert as unknown as string, {}, "PinkLogger");
      if (!output) {
        return null
      }
      const loggerContractId = output.toHex()
      if (!loggerContractId) {
        return null
      }
      setPinkLoggerContractId(loggerContractId)
      setPinkLoggerEnabled(true)
      return loggerContractId
    } finally {
      setIsChecking(false)
    }
  }, [
    setIsChecking, setPinkLoggerEnabled, queryClient, signer, account,
    pruntime, setSystemContractInstance, setPinkLoggerContractId,
  ])
  return [isChecking, checkPinkLogger] as Pairs<boolean, () => Promise<string | null>>
}