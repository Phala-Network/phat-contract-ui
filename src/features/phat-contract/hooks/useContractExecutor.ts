import type {ContractOptions} from '@polkadot/api-contract/types'
import { u64 } from '@polkadot/types'
import type { BN } from '@polkadot/util'
import type { KeyringPair } from '@polkadot/keyring/types';
import type { DepositSettings } from '../atomsWithDepositSettings'

import { useToast } from '@chakra-ui/react'
import { useState, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom, useAtom } from "jotai"
import { waitForAll } from "jotai/utils"
import { queryClientAtom } from 'jotai/query'
import * as R from 'ramda'
import { Keyring } from '@polkadot/keyring'
import { CertificateData, signCertificate, PinkContractPromise } from '@phala/sdk'

import createLogger from "@/functions/createLogger"
import signAndSend from '@/functions/signAndSend'

import { apiPromiseAtom, dispatchEventAtom } from '@/features/parachain/atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import {
  currentMethodAtom,
  currentContractAtom,
  dispatchResultsAtom,
  pinkLoggerResultAtom,
  phatRegistryAtom,
  pinkLoggerAtom,
  useRequestSign,
  currentContractV2Atom,
} from '../atoms'
import { currentArgsFormAtomInAtom, FormActionType, getCheckedForm, getFormIsInvalid, getFormValue } from '../argumentsFormAtom'


const debug = createLogger('chain', 'debug')


interface EstimateGasResult {
  gasLimit: u64
  storageDepositLimit: BN | null
}

async function estimateGas(contract: PinkContractPromise, method: string, cert: CertificateData, args: unknown[]) {
  const { gasRequired, storageDeposit } = await contract.query[method](cert.address, { cert }, ...args)
  const options: EstimateGasResult = {
      gasLimit: (gasRequired as any).refTime,
      storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null
  }
  return options
}

type SignOptions = Parameters<typeof signCertificate>[0]

const currentContractPromiseAtom = atom(async get => {
  const api = get(apiPromiseAtom)
  const registry = get(phatRegistryAtom)
  const { metadata, contractId } = get(currentContractV2Atom)
  if (!metadata) {
    return null
  }
  const contractKey = await registry.getContractKeyOrFail(contractId)
  const contractInstance = new PinkContractPromise(api, registry, metadata, contractId, contractKey)
  return contractInstance
})

export const inputsAtom = atom<Record<string, string>>({})

export const estimateGasAtom = atom(async get => {
  const api = get(apiPromiseAtom)
  const contractInstance = get(currentContractPromiseAtom)
  if (!contractInstance) {
    const options: EstimateGasResult = {
      gasLimit: new u64(api.registry as unknown as ConstructorParameters<typeof u64>[0]),
      storageDepositLimit: null,
    }
    return options
  }
  const selectedMethodSpec = get(currentMethodAtom)
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromUri('//Alice')
  const cert = await signCertificate({ api: api as unknown as SignOptions['api'], pair })
  const txMethods = R.fromPairs(R.map(
    i => [i.meta.identifier, i.meta.method],
    R.values(contractInstance.tx || {})
  ))
  const inputs = getFormValue(get(get(currentArgsFormAtomInAtom)))
  const args = R.map(i => inputs[i.label], selectedMethodSpec!.args)
  const txConf = await estimateGas(contractInstance, txMethods[selectedMethodSpec!.label], cert, args);
  return txConf
})

export enum ExecResult {
  Stop = 'stop',
}

export default function useContractExecutor(): [boolean, (depositSettings: DepositSettings, overrideMethodSpec?: ContractMetaMessage) => Promise<ExecResult | void>] {
  const toast = useToast()
  const [api, selectedMethodSpec, contract, account, queryClient, signer, registry, pinkLogger] = useAtomValue(waitForAll([
    apiPromiseAtom,
    currentMethodAtom,
    currentContractV2Atom,
    currentAccountAtom,
    queryClientAtom,
    signerAtom,
    phatRegistryAtom,
    pinkLoggerAtom,
  ]))
  const appendResult = useSetAtom(dispatchResultsAtom)
  const dispatch = useSetAtom(dispatchEventAtom)
  const setLogs = useSetAtom(pinkLoggerResultAtom)
  const [currentArgsForm, dispatchForm] = useAtom(useAtomValue(currentArgsFormAtomInAtom))
  const [isLoading, setIsLoading] = useState(false)
  const { getCert } = useRequestSign()

  const fn = useCallback(async (depositSettings: DepositSettings, overrideMethodSpec?: ContractMetaMessage) => {
    setIsLoading(true)
    const methodSpec = overrideMethodSpec || selectedMethodSpec
    try {
      if (!api || !account || !methodSpec || !signer || !registry || !contract || !contract.metadata) {
        debug('contractInstance or account is null')
        return
      }
      debug('contract', contract)
      const { metadata, contractId } = contract
      const contractKey = await registry.getContractKeyOrFail(contractId)
      const contractInstance = new PinkContractPromise(api, registry, metadata, contractId, contractKey)

      debug('methodSpec', methodSpec)

      const inputValues = getFormValue(currentArgsForm)
      const checkedArgsForm = getCheckedForm(currentArgsForm)
      const isInvalid = getFormIsInvalid(checkedArgsForm)

      dispatchForm({
        type: FormActionType.SetForm,
        payload: {
          form: checkedArgsForm,
        }
      })
      
      debug('inputValues & errors', inputValues, isInvalid)
      
      // Instant Execution will set `overrideMethodSpec`, and we need skip the check in this case.
      if (isInvalid && !overrideMethodSpec) {
        return ExecResult.Stop
      }

      const queryMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.query || {})
      ))
      const txMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.tx || {})
      ))
      // debug('queryMethods', queryMethods)
      // debug('txMethods', txMethods)

      if (!queryMethods[methodSpec.label] && !txMethods[methodSpec.label]) {
        debug('method not found', methodSpec.label)
        return
      }
      const abiArgs = R.find(i => i.identifier === methodSpec.label, contractInstance.abi.messages)
      debug('parsed abi args:', abiArgs)
      const args = R.map(
        ([arg, abiArg]) => {
          const value = inputValues[arg.label]
          // Because the Text will try convert string prefix with `0x` to hex string, so we need to
          // find a way to bypass that.
          // @see: https://github.com/polkadot-js/api/blob/3d2307f12a7b82abcffb7dbcaac4a6ec6f9fee9d/packages/types-codec/src/native/Text.ts#L36
          if (abiArg.type.type === 'Text') {
            return api.createType('Text', { toString: () => (value as string) })
          }
          try {
            return api.createType(abiArg.type.type, value)
          } catch (err) {
            return value
          }
        },
        R.zip(methodSpec.args, abiArgs!.args)
      ) as unknown[]
      debug('args built: ', args)

      // The certificate is used in query and for gas estimation in tx.
      // const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account as unknown as KeyringPair))
      const cert = await getCert()
      if (!cert) {
        return
      }

      // tx
      if (methodSpec.mutates) {
        let txConf
        if (depositSettings.autoDeposit) {
          txConf = await estimateGas(contractInstance, txMethods[methodSpec.label], cert, args as unknown[]);
          debug('auto deposit: ', txConf)
        } else {
          txConf = R.pick(['gasLimit', 'storageDepositLimit'], depositSettings)
          debug('manual deposit: ', txConf)
        }
        const r1 = await signAndSend(
          // @ts-ignore
          contractInstance.tx[txMethods[methodSpec.label]](txConf as unknown as ContractOptions, ...args),
          account.address,
          signer
        )
        // @ts-ignore
        dispatch(r1.events)
        debug('result: ', r1)
      }
      // query
      else {
        const queryResult = await contractInstance.query[queryMethods[methodSpec.label]](
          account.address,
          { cert },
          ...args
        )
        debug('query result: ', queryResult)
        // @TODO Error handling
        if (queryResult.result.isOk) {
          appendResult({
            contract,
            methodSpec,
            succeed: true,
            args: inputValues,
            output: queryResult.output?.toHuman(),
            completedAt: Date.now(),
          })
        } else {
          appendResult({
            contract,
            methodSpec,
            succeed: false,
            args: inputValues,
            output: queryResult.result.toHuman(),
            completedAt: Date.now(),
          })
        }
      }
    } catch (error) {
      debug('Execute error', error)
      toast({
        title: `Something error`,
        description: `${error}`,
        status: 'error',
        isClosable: true,
      })
    } finally {
      if (pinkLogger) {
        try {
          const { records } = await pinkLogger.getLog(contract.contractId)
          setLogs(R.reverse(records))
        } catch (err) {
          console.log('get log error', err)
        }
      }
      setIsLoading(false)
    }
  }, [
    api, contract, account, selectedMethodSpec, appendResult, dispatch, queryClient,
    signer, setLogs, currentArgsForm, registry, pinkLogger, getCert
  ])
  return [isLoading, fn]
}
