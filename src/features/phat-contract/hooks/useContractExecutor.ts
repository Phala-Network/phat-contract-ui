import type {ContractOptions} from '@polkadot/api-contract/types'
import type { u64 } from '@polkadot/types'
import type { BN } from '@polkadot/util'
import type { KeyringPair } from '@polkadot/keyring/types';
import type { DepositSettings } from '../atomsWithDepositSettings'

import { useToast } from '@chakra-ui/react'
import { useState, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom } from "jotai"
import { useReducerAtom, waitForAll } from "jotai/utils"
import { queryClientAtom, atomWithQuery } from 'jotai/query'
import { ContractPromise } from '@polkadot/api-contract'
import { ApiPromise } from '@polkadot/api'
import * as R from 'ramda'
import { Keyring } from '@polkadot/keyring'

import { CertificateData, create, signCertificate } from '@phala/sdk'
import createLogger from "@/functions/createLogger"
import signAndSend from '@/functions/signAndSend'

import { apiPromiseAtom, dispatchEventAtom } from '@/features/parachain/atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import { querySignCertificate } from '@/features/identity/queries'
import {
  pruntimeURLAtom,
  currentMethodAtom,
  currentContractAtom,
  dispatchResultsAtom,
  pinkLoggerResultAtom,
  currentSystemContractIdAtom,
  currentWorkerIdAtom,
  phatRegistryAtom,
  pinkLoggerAtom,
} from '../atoms'
import { currentArgsFormAtomInAtom, FormActionType, formReducer, getCheckedForm, getFormIsInvalid, getFormValue } from '../argumentsFormAtom'


const debug = createLogger('chain', 'debug')


interface EstimateGasResult {
  gasLimit: u64
  storageDepositLimit: BN | null
}

async function estimateGas(contract: ContractPromise, method: string, cert: CertificateData, args: unknown[]) {
  const { gasRequired, storageDeposit } = await contract.query[method](cert as any, {}, ...args)
  const options: EstimateGasResult = {
      gasLimit: (gasRequired as any).refTime,
      storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null
  }
  return options
}

type CreateOptions = Parameters<typeof create>[0]

type SignOptions = Parameters<typeof signCertificate>[0]

const currentContractPromiseAtom = atom(async get => {
  const api = get(apiPromiseAtom)
  const contract = get(currentContractAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  const remotePubkey = get(currentWorkerIdAtom)
  // @ts-ignore
  const apiCopy = await ApiPromise.create({ ...api._options }) as CreateOptions['api']
  const patched = await create({
      api: apiCopy,
      baseURL: pruntimeURL,
      contractId: contract.contractId,
      remotePubkey: remotePubkey,
      // enable autoDeposit to pay for gas fee
      autoDeposit: true
    }) 
  const contractInstance = new ContractPromise(
    patched.api as unknown as ApiPromise,
    contract.metadata,
    contract.contractId
  )
  return contractInstance
})

export const inputsAtom = atom<Record<string, string>>({})

export const estimateGasAtom = atom(async get => {
  const api = get(apiPromiseAtom)
  const contractInstance = get(currentContractPromiseAtom)
  const selectedMethodSpec = get(currentMethodAtom)
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromUri('//Alice')
  const cert = await signCertificate({ api: api as unknown as SignOptions['api'], pair })
  // const cert = get(certQueryAtom)
  const txMethods = R.fromPairs(R.map(
    i => [i.meta.identifier, i.meta.method],
    R.values(contractInstance.tx || {})
  ))
  // const inputs = get(inputsAtom)
  const inputs = getFormValue(get(get(currentArgsFormAtomInAtom)))
  const args = R.map(
    i => {
      const value = inputs[i.label]
      // if (i.type.type === 1 && typeof value === 'string') {
      //   return [value]
      // }
      return value
    },
    selectedMethodSpec!.args
  )
  const txConf = await estimateGas(contractInstance, txMethods[selectedMethodSpec!.label], cert, args);
  return txConf
})

export enum ExecResult {
  Stop = 'stop',
}

export default function useContractExecutor(): [boolean, (depositSettings: DepositSettings, overrideMethodSpec?: ContractMetaMessage) => Promise<ExecResult | void>] {
  const toast = useToast()
  const [api, pruntimeURL, selectedMethodSpec, contract, account, queryClient, signer, registry, pinkLogger] = useAtomValue(waitForAll([
    apiPromiseAtom,
    pruntimeURLAtom,
    currentMethodAtom,
    currentContractAtom,
    currentAccountAtom,
    queryClientAtom,
    signerAtom,
    phatRegistryAtom,
    pinkLoggerAtom,
  ]))
  const remotePubkey = useAtomValue(currentWorkerIdAtom)
  // const data = useAtomValue(remotePubkeyAtom)
  // const remotePubkey = R.path([0,1,0], data) as string
  const systemContractId = useAtomValue(currentSystemContractIdAtom)
  const appendResult = useSetAtom(dispatchResultsAtom)
  const dispatch = useSetAtom(dispatchEventAtom)
  const setLogs = useSetAtom(pinkLoggerResultAtom)
  // const currentArgsFormValueOf = useAtomValue(currentArgsFormValueOfAtom)
  // const currentArgsFormValidate = useSetAtom(currentArgsFormValidateAtom)
  // const currentArgsFormErrorsOf = useAtomValue(currentArgsFormErrorsOfAtom)
  const currentArgsFormAtom = useAtomValue(currentArgsFormAtomInAtom)
  const [currentArgsForm, dispatchForm] = useReducerAtom(currentArgsFormAtom, formReducer)
  const [isLoading, setIsLoading] = useState(false)

  const fn = useCallback(async (depositSettings: DepositSettings, overrideMethodSpec?: ContractMetaMessage) => {
    setIsLoading(true)
    const methodSpec = overrideMethodSpec || selectedMethodSpec
    try {
      if (!api || !account || !methodSpec || !signer) {
        debug('contractInstance or account is null')
        return
      }
      debug('contract', contract)
      // @ts-ignore
      const apiCopy = await ApiPromise.create({ ...api._options })
      const patched = await create({
          api: apiCopy as unknown as CreateOptions['api'],
          baseURL: pruntimeURL,
          contractId: contract.contractId,
          remotePubkey: remotePubkey,
          // enable autoDeposit to pay for gas fee
          autoDeposit: true
        })
      const contractInstance = new ContractPromise(
        patched.api as unknown as ApiPromise,
        contract.metadata,
        contract.contractId
      )
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
      
      if (isInvalid) {
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
          return api.createType(abiArg.type.type, value)
        },
        R.zip(methodSpec.args, abiArgs!.args)
      )
      debug('args built: ', args)

      // The certificate is used in query and for gas estimation in tx.
      const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account as unknown as KeyringPair))

      // tx
      if (methodSpec.mutates) {
        // const { signer } = await web3FromSource(account.meta.source)
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
        // 2022-11-01: temporary disable block barrier since that's not required for all cases.
        // const prpc = await createPruntimeApi(pruntimeURL)
        // const prpc = createPruntimeApi(pruntimeURL)
        // console.log('prpc', prpc)
        // await blockBarrier(contractInstance.api, prpc)
      }
      // query
      else {
        const queryResult = await contractInstance.query[queryMethods[methodSpec.label]](
          // @FIXME this is a hack to make the ts compiler happy.
          cert as unknown as string,
          // querySignCache as unknown as string,
          { value: 0, gasLimit: -1 },
          // @ts-ignore
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
        const { records } = await pinkLogger.getLog(contract.contractId)
        setLogs(R.reverse(records))
      }
      setIsLoading(false)
    }
  }, [
    api, pruntimeURL, contract, account, selectedMethodSpec, appendResult, dispatch, queryClient,
    signer, setLogs, systemContractId, currentArgsForm, registry, pinkLogger
  ])
  return [isLoading, fn]
}
