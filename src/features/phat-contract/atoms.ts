import type { ContractPromise } from '@polkadot/api-contract'
import type { AnyJson } from '@polkadot/types/types'
import type { Option } from '@polkadot/types'

import { isClosedBetaEnv } from '@/vite-env'
import { useMemo, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { atomWithReset, atomWithStorage, loadable } from 'jotai/utils'
import { atomWithQuery } from 'jotai/query'
import * as R from 'ramda'
import { Abi } from '@polkadot/api-contract'
import { OnChainRegistry, PinkLoggerContractPromise } from '@phala/sdk'
import { validateHex } from '@phala/ink-validator'

import { apiPromiseAtom } from '@/features/parachain/atoms'
import { queryClusterList, queryEndpointList } from './queries'
import { endpointAtom } from '@/atoms/endpointsAtom'


export interface SelectorOption {
  value: string
  label: string
  selected: boolean
  argCounts: number
}

export interface LocalContractInfo {
  contractId: string;
  metadata: ContractMetadata;
  savedAt?: number;
}

export interface ContractExecuteResult {
  contract: LocalContractInfo;
  methodSpec: ContractMetaMessage;
  succeed: boolean;
  args: Record<string, unknown>;
  output?: AnyJson;
  completedAt: number;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Staging contract candidate for Upload & instantiate
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const candidateAtom = atom<ContractMetadata | null>(null)

export const candidateFileInfoAtom = atomWithReset({ name: '', size: 0 })
export const candidateAllowIndeterminismAtom = atomWithReset(false)

export const contractParserErrorAtom = atom('')
export const contractWASMInvalid = atom(false)

export const contractAvailableSelectorAtom = atom(get => {
  const contract = get(candidateAtom)
  if (!contract) {
    return []
  }
  const spec = contract.V3 ? contract.V3.spec : contract.spec
  let defaults: any = spec.constructors.filter(i => i.label === 'default')
  if (!defaults) {
    defaults = R.head(spec.constructors)
  }
  return [...spec.constructors.map(i => ({
    value: i.selector,
    label: i.label,
    default: i.selector === defaults?.selector,
    argCounts: i.args.length,
  }))]
})

export const contractSelectedInitSelectorAtom = atom('')

export const contractSelectorOptionListAtom = atom(get => {
  const options = get(contractAvailableSelectorAtom)
  const selected = get(contractSelectedInitSelectorAtom)
  return options.map(i => ({
    value: i.value,
    label: i.label,
    selected: selected ? i.value === selected : i.default,
    argCounts: i.argCounts,
  }))
})

export const contractFinalInitSelectorAtom = atom(get => {
  const options = get(contractSelectorOptionListAtom)
  const found = options.filter(i => i.selected)
  if (found.length) {
    return found[0].value
  }
  return ''
})

interface FileInfo {
  file: File
  isCheckWASM: boolean
}

export const contractCandidateAtom = atom('', (get, set, fileInfo: FileInfo) => {
  const { file, isCheckWASM } = fileInfo
  // file size can't > 2MB
  if (file?.size && file.size / 1024 / 1024 > 2) {
  // // easy to debug
  // if (file?.size && file.size > 2) {
    set(contractParserErrorAtom, 'Your contract file size is over 2MB. Please change to another one.')
    return
  }

  const reader = new FileReader()
  set(contractParserErrorAtom, '')
  set(contractWASMInvalid, false)
  reader.addEventListener('load', () => {
    try {
      const contract = JSON.parse(reader.result as string)
      // if (!contract || !contract.source || !contract.source.hash || !contract.source.wasm) {
      if (!contract || !contract.source || !contract.source.hash) {
        set(contractParserErrorAtom, "Your contract file is invalid.")
        return
      }

      try {
        new Abi(contract)
      } catch (err) {
        set(contractParserErrorAtom, `Your contract file is invalid: ${err}`)
        return
      }

      if (isCheckWASM) {
        // const isAllowIndeterminism = get(candidateAllowIndeterminismAtom)
        // if valid pass, validResult is ''
        // if valid failed, validResult is the failed error
        // const validResult = validateHex((contract.source?.wasm || '') as string, isAllowIndeterminism)
        const validResult = validateHex((contract.source?.wasm || '') as string, false)
        // console.log('contract.source?.wasm', validResult, isAllowIndeterminism)
        if (validResult) {
          set(contractParserErrorAtom, `Your contract file is invalid: ${validResult}`)
          set(contractWASMInvalid, true)
          return
        }
      }

      set(candidateFileInfoAtom, { name: file.name, size: file.size })
      set(candidateAtom, contract)
    } catch (e) {
      console.error(e)
      set(contractParserErrorAtom, `Your contract file is invalid: ${e}`)
    }
  })
  reader.readAsText(file, 'utf-8')
})

export const contractAttachTargetAtom = atom('')

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Contract Metadata
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

type ContractKey = string

export const localContractsAtom = atomWithStorage<
  Record<ContractKey, LocalContractInfo>
>('owned-contracts', {})

export function useContractList() {
  const localContracts = useAtomValue(localContractsAtom)
  const apiQuery = useAtomValue(loadable(apiPromiseAtom))
  const instantiatedContractListQuery = useQuery(
    ['phalaPhatContracts.contracts', apiQuery.state, localContracts],
    async () => {
      const contractKeys = R.keys(localContracts)
      if (apiQuery.state !== 'hasData' || !apiQuery.data || contractKeys.length === 0) {
        return {}
      }
      const api = apiQuery.data
      const queries = R.map(i => [api.query.phalaPhatContracts.contracts, i], contractKeys)
      // @ts-ignore
      const results: Option<BasicContractInfo>[] = await (api.queryMulti(queries) as unknown as Promise<Option<BasicContractInfo>[]>)
      const pairs = R.map(
        ([contractKey, info]) => info.isSome ? [contractKey, true] : [contractKey, false],
        R.zip(contractKeys, results)
      ) as [string, boolean][]
      return R.fromPairs<boolean>(pairs)
    }
  )
  return useMemo(() => {
    const { isLoading, data } = instantiatedContractListQuery
    const availableChecks = data || {}
    return R.pipe(
      R.toPairs,
      R.sortBy(i => R.propOr(0, 'savedAt', i[1])),
      lst => R.reverse(lst) as unknown as [ContractKey, LocalContractInfo][],
      R.map(([k, info]) => {
        return [k, { ...info, isLoading, isAvailable: availableChecks[k] as boolean }] as [ContractKey, LocalContractInfo & { isLoading: boolean, isAvailable: boolean }]
      }),
    )(localContracts)
  }, [localContracts, instantiatedContractListQuery])
}

export function useRemoveLocalContract(contractKey: ContractKey) {
  const updateLocalContracts = useSetAtom(localContractsAtom)
  return useCallback(() => {
    updateLocalContracts(data => R.omit([contractKey], data))
  }, [contractKey, updateLocalContracts])
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Cluster
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const currentClusterIdAtom = atomWithStorage('user-selected-cluster', '0x0000000000000000000000000000000000000000000000000000000000000000')

export const registeredClusterListAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  return queryClusterList(api)
})

export const availableClusterOptionsAtom = atom(get => {
  const clusters = get(registeredClusterListAtom)
  const options = clusters.map(([id, obj]) => {
    const { permission } = obj
    const permissionKey = R.head(R.keys(permission))
    return { label: `[${permissionKey}] ${id.substring(0, 6)}...${id.substring(id.length - 6)}`, value: id }
  })
  return options
})

export const currentClusterAtom = atom(get => {
  const clusters = get(registeredClusterListAtom)
  let currentClusterId = get(currentClusterIdAtom)
  const found = R.find(([id]) => id === currentClusterId, clusters)
  if (found) {
    return found[1]
  }
  if (clusters.length) {
    return clusters[0][1]
  }
  return null
}, (_, set, value: string) => {
  set(currentClusterIdAtom, value)
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Worker
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const userSelectedWorkerIdAtom = atomWithStorage<Record<string, string>>('user-selected-worker', {})

function shuffle<T>(lst: Readonly<T[]>) {
  const idx = Math.floor(lst.length * Math.random())
  return lst[idx]
}

export const currentWorkerIdAtom = atom(
  get => {
    const rec = get(userSelectedWorkerIdAtom)
    const endpoint = get(endpointAtom)
    const workers = get(availableWorkerListAtom)
    if (rec[endpoint]) {
      if (!R.includes(rec[endpoint], workers)) {
        console.log('user selected worker is not available', rec[endpoint], workers)
        return shuffle(workers)
      }
      return rec[endpoint]
    }

    if (isClosedBetaEnv) {
      return shuffle(workers)
    } else {
      return R.head(workers)
    }
  },
  (get, set, value: string) => {
    const endpoint = get(endpointAtom)
    const rec = get(userSelectedWorkerIdAtom)
    set(userSelectedWorkerIdAtom, {...rec, [endpoint]: value})
  }
)

export const availableWorkerListAtom = atom(get => {
  const clusterInfo = get(currentClusterAtom)
  if (clusterInfo) {
    return clusterInfo.workers
  }
  return []
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// PRuntime
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const DEFAULT_ENDPOINT = 'https://poc5.phala.network/tee-api-1'

export const userSelectedPruntimeAtom = atomWithStorage<Record<string, string>>('user-selected-pruntime', {})

export const pruntimeURLAtom = atom(
  get => {
    const rec = get(userSelectedPruntimeAtom)
    const endpoint = get(endpointAtom)
    if (rec[endpoint]) {
      return rec[endpoint]
    }
    const pruntimes = get(availablePruntimeListAtom)
    return R.head(pruntimes) || DEFAULT_ENDPOINT
  },
  (get, set, value: string) => {
    const endpoint = get(endpointAtom)
    const rec = get(userSelectedPruntimeAtom)
    set(userSelectedPruntimeAtom, {...rec, [endpoint]: value})
  }
)

export const pruntimeListQueryAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  const workerId = get(currentWorkerIdAtom)
  return queryEndpointList(api, workerId)
})

export const availablePruntimeListAtom = atom(get => {
  const result = get(pruntimeListQueryAtom)
  if (result) {
    return R.pathOr([], [0, 1, 'V1'], result)
  }
  return []
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Registry
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const phatRegistryAtom = atom(async (get) => {
  const api = get(apiPromiseAtom)
  const clusterId = get(currentClusterIdAtom)
  const workerId = get(currentWorkerIdAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  const registry = await OnChainRegistry.create(api, { clusterId, workerId, pruntimeURL })
  return registry
})

export const pinkLoggerAtom = atom(async (get) => {
  const api = get(apiPromiseAtom)
  const registry = get(phatRegistryAtom)
  if (!registry.systemContract) {
    return null
  }
  const pinkLogger = await PinkLoggerContractPromise.create(api, registry, registry.systemContract)
  return pinkLogger
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// System Contract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const currentSystemContractIdAtom = atom(get => {
  const clusterInfo = get(currentClusterAtom)
  if (clusterInfo) {
    return clusterInfo.systemContract
  }
  return null
})

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Sidevm Contract / Pink Logger Cotnract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const pinkLoggerResultAtom = atom<PinkLoggerRecord[]>([])

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
//  Current Contract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const currentContractIdAtom = atom('')

export const currentMethodAtom = atom<ContractMetaMessage | null>(null)

export const currentContractAtom = atom(get => {
  const contractId = get(currentContractIdAtom)
  const contracts = get(localContractsAtom)
  return contracts[contractId]
})

export const currentAbiAtom = atom(get => {
  const contract = get(currentContractAtom)
  const abi = new Abi(contract.metadata)
  return abi
})

export const messagesAtom = atom(get => {
  const contract = get(currentContractAtom)
  if (!contract) {
    return []
  }
  if (contract.metadata.V3) {
    return contract.metadata.V3.spec.messages || []
  }
  return contract.metadata.spec.messages || []
})

export const phalaFatContractQueryAtom = atom(async get => {
  const api = get(apiPromiseAtom)
  const info = get(currentContractAtom)
  if (!api || !info) {
    return null
  }
  const result = await api.query.phalaPhatContracts.contracts(info.contractId)
  return result.toHuman() as unknown as ContractInfo
})

export const contractInstanceAtom = atom<ContractPromise | null>(null)

export const resultsAtom = atomWithReset<ContractExecuteResult[]>([])

export const dispatchResultsAtom = atom(null, (get, set, result: ContractExecuteResult) => {
  const prev = get(resultsAtom)
  set(resultsAtom, [ result, ...prev ])
})

export const instantiateTimeoutAtom = atom(60)