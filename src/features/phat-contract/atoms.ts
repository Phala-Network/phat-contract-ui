import { Abi } from '@polkadot/api-contract'
import type { ContractPromise } from '@polkadot/api-contract'
import type { AnyJson } from '@polkadot/types/types'

import { atom } from 'jotai'
import { atomWithReset, atomWithStorage, waitForAll } from 'jotai/utils'
import { atomWithQuery } from 'jotai/query'
import * as R from 'ramda'

import { apiPromiseAtom } from '@/features/parachain/atoms'
import { queryClusterList, queryContractList, queryEndpointList } from './queries'
import { endpointAtom } from '@/atoms/endpointsAtom'

import { validateHex } from '@phala/ink-validator'
import { isClosedBetaEnv } from '@/vite-env'

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
  return [...spec.constructors.map(i => ({
    value: i.selector,
    label: i.label,
    default: i.label === 'default',
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

export const localContractsAtom = atomWithStorage<
  Record<string, LocalContractInfo>
>('owned-contracts', {})

export const onChainContractsAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  return queryContractList(api)
})

export const availableContractsAtom = atom(get => {
  const onLocal = get(localContractsAtom)
  const onChain = get(onChainContractsAtom)
  const onChainKeys = Object.keys(onChain)
  return R.pipe(
    R.filter((i: Pairs<string, LocalContractInfo>) => R.includes(i[0], onChainKeys)),
    R.sortBy((i) => R.propOr(0, 'savedAt', i[1])),
    lst => R.reverse<Pairs<string, LocalContractInfo>>(lst),
  )(Object.entries(onLocal))
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Cluster
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const currentClusterIdAtom = atom('0x0000000000000000000000000000000000000000000000000000000000000000')

export const registeredClusterListAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  return queryClusterList(api)
})

export const availableClusterOptionsAtom = atom(get => {
  const clusters = get(registeredClusterListAtom)
  const endpoint = get(endpointAtom)
  const options = clusters.map(([id, obj]) => {
    const { permission } = obj
    const permissionKey = R.head(R.keys(permission))
    return { label: `[${permissionKey}] ${id.substring(0, 6)}...${id.substring(id.length - 6)}`, value: id }
  }).filter(i => {
    if (endpoint === 'wss://phat-beta-node.phala.network/khala/ws' && i.value === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return false
    }
    return true
  })
  
  if (isClosedBetaEnv) {
    const closedBetaOptions = options.filter(i => {
      if (endpoint === 'wss://phat-beta-node.phala.network/khala/ws' && i.value === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          return false
      }
      return true
    })
    return closedBetaOptions
  } else {
    return options
  }
})

export const currentClusterAtom = atom(get => {
  const clusters = get(registeredClusterListAtom)
  let currentClusterId = get(currentClusterIdAtom)
  const endpoint = get(endpointAtom)
  if (isClosedBetaEnv && endpoint === 'wss://phat-beta-node.phala.network/khala/ws' && currentClusterId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    currentClusterId = '0x0000000000000000000000000000000000000000000000000000000000000001'
  }
  const found = R.find(([id]) => id === currentClusterId, clusters)
  if (found) {
    return found[1]
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
    // 2023-01-16: hotfix for workers down
    return R.without(
      [
        "0x9e10f9be30e98a2a689c255f0780d6d58c6ca29dad1ea3f77ec94aaa8c9c174f",
        "0x50cfa4b7a48893c8772cf348d7c2eb03071263a7f8ab4381a20e1df2a99dbc3a"
      ],
      clusterInfo.workers
    )
    // return clusterInfo.workers
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
  const result = await api.query.phalaFatContracts.contracts(info.contractId)
  return result.toHuman() as ContractInfo
})

export const contractInstanceAtom = atom<ContractPromise | null>(null)

export const resultsAtom = atomWithReset<ContractExecuteResult[]>([])

export const dispatchResultsAtom = atom(null, (get, set, result: ContractExecuteResult) => {
  const prev = get(resultsAtom)
  set(resultsAtom, [ result, ...prev ])
})

export const instantiateTimeoutAtom = atom(60)