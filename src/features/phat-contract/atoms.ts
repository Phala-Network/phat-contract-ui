import type { Abi, ContractPromise } from '@polkadot/api-contract'
import { AnyJson } from '@polkadot/types/types'

import { atom } from 'jotai'
import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { atomWithQuery } from 'jotai/query'
import * as R from 'ramda'

import { apiPromiseAtom } from '@/features/parachain/atoms'
import { queryClusterList, queryContractList } from './queries'

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

export const contractParserErrorAtom = atom('')

export const contractAvailableSelectorAtom = atom(get => {
  const contract = get(candidateAtom)
  if (!contract) {
    return []
  }
  return [...contract.V3.spec.constructors.map(i => ({
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

export const contractCandidateAtom = atom('', (_, set, file: File) => {
  const reader = new FileReader()
  set(contractParserErrorAtom, '')
  reader.addEventListener('load', () => {
    try {
      const contract = JSON.parse(reader.result as string)
      if (!contract || !contract.source || !contract.source.hash || !contract.source.wasm) {
        set(contractParserErrorAtom, "Your contract file is invalid.")
        return
      }
      if (!contract.V3) {
        set(contractParserErrorAtom, "Your contract metadata version is too low, Please upgrade your cargo-contract with `cargo install cargo-contract --force`.")
        return
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
  console.log('clusters', clusters)
  return clusters.map(([id, obj]) => {
    const { permission } = obj
    return { label: `[${permission}] ${id.substring(0, 6)}...${id.substring(id.length - 6)}`, value: id }
  })
})

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// PRuntime
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// export const pruntimeURLAtom = atom('https://poc5.phala.network/tee-api-1')
export const pruntimeURLAtom = atom('http://192.168.50.2:8000')

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// System Contract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const systemContractInstanceAtom = atom(get => {
})

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Sidevm Contract / Pink Logger Cotnract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const pinkLoggerContractInstanceAtom = atom(get => {

})

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

export const messagesAtom = atom(get => {
  const contract = get(currentContractAtom)
  if (!contract) {
    return []
  }
  return contract.metadata.V3.spec.messages || []
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