import { atom } from 'jotai'
import { atomWithStorage, useAtomValue } from 'jotai/utils'
import { ContractPromise } from '@polkadot/api-contract'

import { create } from '../../sdk'

import { rpcApiInstanceAtom } from '@/atoms/foundation'


type derviedContractAction = {
  type: 'init';
}

type PhalaFatContractQueryResult = {
  deployer: string;
  codeIndex: {
    WasmCode: string;
  }
  salt: string;
  clusterId: string;
  instantiateData: string;
}

const pruntimeURLAtom = atom('https://poc5.phala.network/tee-api-1')

export type LocalContractInfo = {
  contractId: string;
  metadata: ContractMetadata;
  createdAt: number;
}

export const contractsAtom = atomWithStorage<
  Record<string, LocalContractInfo>
>('owned-contracts', {})

export const currentContractIdAtom = atom('')

export const currentContractAtom = atom(get => {
  const contractId = get(currentContractIdAtom)
  const contracts = get(contractsAtom)
  return contracts[contractId]
})

export const phalaFatContractQueryAtom = atom(async get => {
  const api = get(rpcApiInstanceAtom)
  const info = get(currentContractAtom)
  if (!api || !info) {
    return null
  }
  const result = await new Promise(resolve => {
    api.query.phalaFatContracts.contracts(info.contractId, (result: { toHuman: () => unknown }) => resolve(result.toHuman()))
  })
  return result as PhalaFatContractQueryResult
})

export const contractInstanceAtom = atom<ContractPromise | null>(null)

export const derviedContractAtom = atom(async (get) => {
  const api = get(rpcApiInstanceAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  const contract = get(currentContractAtom)
  if (!api) {
    return
  }
  const contractPromise = new ContractPromise(
    await create({api, baseURL: pruntimeURL, contractId: contract.contractId}),
    contract.metadata,
    contract.contractId
  )
  return contractPromise
})