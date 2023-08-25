import type { Atom, WritableAtom } from 'jotai'
import type { u64 } from '@polkadot/types'
import type { BN } from '@polkadot/util'

import { atom } from 'jotai'
import * as R from 'ramda'
import { type NormalizedFormAtom, getFormValue } from './argumentsFormAtom'


export interface DepositSettings {
  autoDeposit: boolean
  gasLimit?: number | null
  storageDepositLimit?: number | null
  gasPrice?: number
}

export type DepositSettingsValue = (DepositSettings & { autoDeposit: false })
  | (Omit<DepositSettings, 'gasLimit' | 'storageDepositLimit'> & { autoDeposit: true })

export interface EstimateResultLike {
  gasLimit: u64
  storageDepositLimit: BN | null
  gasPrice?: number
}

export type ReadOnlyDepositSettingsValueAtom = Atom<DepositSettingsValue>

export type DepositSettingsDispatcherAtom = WritableAtom<DepositSettings, Partial<Required<DepositSettings>>>

export type DepositSettingsDispatcherV2Atom = WritableAtom<Promise<DepositSettings>, Partial<Required<DepositSettings>>>

export type DepositAtoms = Pairs<ReadOnlyDepositSettingsValueAtom, DepositSettingsDispatcherAtom>

export type DepositV2Atoms = Pairs<ReadOnlyDepositSettingsValueAtom, DepositSettingsDispatcherV2Atom>


export function atomsWithDepositSettings(estimateGasAtom: Atom<Promise<EstimateResultLike>>): DepositAtoms {
  const valueAtom = atom<DepositSettingsValue>({ autoDeposit: true })

  const dispatcherAtom = atom(
    get => {
      const estimate = get(estimateGasAtom)
      const store = get(valueAtom)
      if (store.autoDeposit) {
        const value: DepositSettings = {
          autoDeposit: true,
          gasLimit: estimate.gasLimit.toNumber(),
          storageDepositLimit: estimate.storageDepositLimit ? estimate.storageDepositLimit.toNumber() : 0,
          gasPrice: estimate.gasPrice,
        }
        return value
      }
      return { ...store, gasPrice: estimate.gasPrice }
    },
    (get, set, updates: Partial<Required<DepositSettings>>) => {
      if (!updates.autoDeposit) {
        const estimate = get(estimateGasAtom)
        const prev = get(valueAtom)
        let gasLimit: number | null | undefined = updates.gasLimit
        let storageDepositLimit: number | null | undefined = updates.storageDepositLimit

        if (gasLimit === undefined) {
          if (!prev.autoDeposit && prev.gasLimit !== undefined) {
            gasLimit = prev.gasLimit
          } else if (estimate.gasLimit) {
            gasLimit = estimate.gasLimit.toNumber()
          }
        }

        if (storageDepositLimit === undefined) {
          if (!prev.autoDeposit) {
            if (prev.storageDepositLimit !== null) {
              storageDepositLimit = prev.storageDepositLimit
            }
          }
          if (estimate.storageDepositLimit) {
            storageDepositLimit = estimate.storageDepositLimit.toNumber()
          }
        }
        let value: DepositSettingsValue = {
          autoDeposit: false,
          gasLimit,
          storageDepositLimit,
        }
        set(valueAtom, value)
      } else {
        set(valueAtom, { autoDeposit: true })
      }
    }
  )

  return [valueAtom, dispatcherAtom]
}


export function depositSettingsAtomsWithEstimatePerformer(dataAtom: NormalizedFormAtom, getEstimateResult: ((data: any) => Promise<EstimateResultLike>)): DepositV2Atoms {
  const valueAtom = atom<DepositSettingsValue>({ autoDeposit: true })

  const dispatcherAtom = atom(
    async get => {
      const formData = get(dataAtom)
      const args = getFormValue(formData)

      const estimate = await getEstimateResult(args)
      // const estimate = get(estimateGasAtom)
      const store = get(valueAtom)
      if (store.autoDeposit) {
        const value: DepositSettings = {
          autoDeposit: true,
          gasLimit: estimate.gasLimit.toNumber(),
          storageDepositLimit: estimate.storageDepositLimit ? estimate.storageDepositLimit.toNumber() : 0,
          gasPrice: estimate.gasPrice,
        }
        return value
      }
      return { ...store, gasPrice: estimate.gasPrice }
    },
    async (get, set, updates: Partial<Required<DepositSettings>>) => {
      if (!updates.autoDeposit) {
        const formData = get(dataAtom)
        const args = getFormValue(formData)
        const estimate = await getEstimateResult(args)
        const prev = get(valueAtom)
        let gasLimit: number | null | undefined = updates.gasLimit
        let storageDepositLimit: number | null | undefined = updates.storageDepositLimit

        if (gasLimit === undefined) {
          if (!prev.autoDeposit && prev.gasLimit !== undefined) {
            gasLimit = prev.gasLimit
          } else if (estimate.gasLimit) {
            gasLimit = estimate.gasLimit.toNumber()
          }
        }

        if (storageDepositLimit === undefined) {
          if (!prev.autoDeposit) {
            if (prev.storageDepositLimit !== null) {
              storageDepositLimit = prev.storageDepositLimit
            }
          }
          if (estimate.storageDepositLimit) {
            storageDepositLimit = estimate.storageDepositLimit.toNumber()
          }
        }
        let value: DepositSettingsValue = {
          autoDeposit: false,
          gasLimit,
          storageDepositLimit,
        }
        set(valueAtom, value)
      } else {
        set(valueAtom, { autoDeposit: true })
      }
    }
  )

  return [valueAtom, dispatcherAtom]
}

