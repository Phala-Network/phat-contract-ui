import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import type { DepositSettingsValue } from '../atomsWithDepositSettings'

import { useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { useToast } from '@chakra-ui/react'
import * as R from 'ramda'

import signAndSend from '@/functions/signAndSend'
import { signerAtom } from '@/features/identity/atoms'
import { apiPromiseAtom, eventsAtom } from '@/features/parachain/atoms'

import {
  contractSelectedInitSelectorAtom,
  localContractsAtom,
  instantiateTimeoutAtom,
  phatRegistryAtom,
} from '../atoms'
import { PinkCodePromise, signCertificate } from '@phala/sdk'

export default function useUploadCodeAndInstantiate() {
  const api = useAtomValue(apiPromiseAtom)
  const signer = useAtomValue(signerAtom)
  const reset = useResetAtom(eventsAtom)
  const instantiateTimeout = useAtomValue(instantiateTimeoutAtom)
  const toast = useToast()
  const saveContract = useSetAtom(localContractsAtom)
  const chooseInitSelector = useAtomValue(contractSelectedInitSelectorAtom)
  const registry = useAtomValue(phatRegistryAtom)

  return useCallback(async (account: InjectedAccountWithMeta, contract:ContractMetadata, clusterId: string, depositSettings?: DepositSettingsValue) => {
    console.group('Instantiate Contract:', clusterId)
    try {
      if (!signer) {
        return false
      }

      // Clear the Event Panel.
      reset()
  
      const spec = contract.V3 ? contract.V3.spec : contract.spec
      if (spec.constructors.length === 0) {
        throw new Error('No constructor found.')
      }
      const defaultInitSelector = R.pipe(
        R.filter((c: ContractMetaConstructor) => c.label === 'default' || c.label === 'new'),
        R.sortBy((c: ContractMetaConstructor) => c.args.length),
        i => R.head<ContractMetaConstructor>(i),
        (i) => i ? i.selector : undefined,
      )(spec.constructors)

      const initSelector = chooseInitSelector || defaultInitSelector || R.head(spec.constructors)?.selector
      console.log('user choose initSelector: ', chooseInitSelector)
      console.log('default initSelector: ', defaultInitSelector)
      if (!initSelector) {
        throw new Error('No valid initSelector specified.')
      }
      const methodName = R.prop('label', R.find(i => i.selector === initSelector, spec.constructors)) as string
      console.info('Final initSelector: ', initSelector, 'clusterId: ', clusterId, 'constructorName', methodName)

      const [gasLimit, storageDepositLimit] = (() => {
        if (!depositSettings || depositSettings.autoDeposit) {
          return [1e12, null]
        }
        return [(depositSettings.gasLimit || 0) < 1e12 ? 1e12 : depositSettings.gasLimit, depositSettings.storageDepositLimit]
      })()
      console.log('transaction gasLimit & storageDepositLimit: ', gasLimit, storageDepositLimit, depositSettings)

      const clusterBalance = await registry.getClusterBalance({ signer, address: account.address, account } as any, account.address)
      if ((clusterBalance.free.toNumber() / 1e12) < 10) {
        await signAndSend(registry.transferToCluster(account.address, 1e12 * 10), account.address, signer)
      }

      // TODO It's cacheable.
      const cert = await signCertificate({ signer, account, api })

      const codePromise = new PinkCodePromise(api, registry, contract, contract.source.wasm)
      // @ts-ignore
      const { result: uploadResult } = await signAndSend(codePromise.tx[methodName]({}), account.address, signer)
      await uploadResult.waitFinalized(account, cert, 120_000)
      console.log('Uploaded. Wait for the contract to be instantiated...', uploadResult)

      const { blueprint } = uploadResult
      const { gasRequired, storageDeposit, salt } = await blueprint.query[methodName](account.address, { cert }) // Support instantiate arguments.
      // @ts-ignore
      const { result: instantiateResult }= await signAndSend(
        blueprint.tx[methodName]({ gasLimit: gasRequired.refTime, storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null, salt }),
        account.address,
        signer
      )
      await instantiateResult.waitFinalized()
      console.log('Contract uploaded & instantiated: ', instantiateResult)

      // Save contract metadata to local storage
      const { contractId } = instantiateResult
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      console.log('Save contract metadata to local storage.')
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} }))

      console.info('Auto staking to the contract...');
      const stakeResult = await signAndSend(
        // @ts-ignore
        api.tx.phalaPhatTokenomic.adjustStake(
          contractId,
          1e10,  // stake 1 cent
        ),
        account.address,
        signer
      )
      console.log('Stake submitted', stakeResult)

      toast({
        title: 'Instantiate Requested.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      return contractId
    } catch (err) {
      console.error(err)
      toast({
        title: `${err}`,
        status: 'error',
        isClosable: true,
      })
    } finally {
      console.groupEnd()
    }
  }, [api, registry, reset, toast, saveContract, chooseInitSelector, instantiateTimeout])
}
