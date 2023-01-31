import type {Bytes} from '@polkadot/types-codec'
import type {ContractOptions} from '@polkadot/api-contract/types'

import { useToast } from '@chakra-ui/react'
import { useState, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom } from "jotai"
import { useReducerAtom, waitForAll } from "jotai/utils"
import { queryClientAtom, atomWithQuery } from 'jotai/query'
import { ContractPromise } from '@polkadot/api-contract'
import { stringToHex } from '@polkadot/util'
import { ApiPromise } from '@polkadot/api'
import * as R from 'ramda'
import { Keyring } from '@polkadot/keyring'

import { CertificateData, create, signCertificate } from '@phala/sdk'
import createLogger from "@/functions/createLogger"
import signAndSend from '@/functions/signAndSend'

import { apiPromiseAtom, dispatchEventAtom } from '@/features/parachain/atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import { querySignCertificate } from '@/features/identity/queries'
import { queryPinkLoggerContract } from '../queries'

import {
  pruntimeURLAtom,
  currentMethodAtom,
  currentContractAtom,
  dispatchResultsAtom,
  pinkLoggerResultAtom,
  currentSystemContractIdAtom,
  currentWorkerIdAtom,
} from '../atoms'
import { singleInputsValidator } from '@/functions/argumentsValidator'
import { currentArgsFormAtomInAtom, FormActionType, formReducer, getCheckedForm, getFieldValue, getFormIsInvalid, getFormValue } from '../argumentsFormAtom'
// import { currentArgsFormErrorsOfAtom, currentArgsFormValidateAtom, currentArgsFormValueOfAtom } from '../argumentsFormAtom'

interface InkResponse {
  nonce: string
  result: {
    Ok?: {
      InkMessageReturn: string
    }
  }
}

export interface DepositSettings {
  autoDeposit: boolean
  gasLimit?: number | null
  storageDepositLimit?: number | null
}

const debug = createLogger('chain', 'debug')

async function estimateGas(contract: ContractPromise, method: string, cert: CertificateData, args: unknown[]) {
  const { gasRequired, storageDeposit } = await contract.query[method](cert as any, {}, ...args)
  const options = {
      gasLimit: (gasRequired as any).refTime,
      storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null
  }
  return options
}

const defaultTxConf = { gasLimit: "1000000000000", storageDepositLimit: null }

const currentContractPromiseAtom = atom(async get => {
  const api = get(apiPromiseAtom)
  const contract = get(currentContractAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  const remotePubkey = get(currentWorkerIdAtom)
  // @ts-ignore
  const apiCopy = await ApiPromise.create({ ...api._options })
  const contractInstance = new ContractPromise(
    (await create({
      api: apiCopy,
      baseURL: pruntimeURL, contractId: contract.contractId, remotePubkey: remotePubkey,
      // enable autoDeposit to pay for gas fee
      autoDeposit: true
    })).api,
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
  const cert = await signCertificate({ api, pair })
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
  console.log('useContractEstimeateGas', txConf.gasLimit.toHuman(), txConf.storageDepositLimit?.toHuman())
  return txConf
})

export enum ExecResult {
  Stop = 'stop',
}

export default function useContractExecutor(): [boolean, (depositSettings: DepositSettings, overrideMethodSpec?: ContractMetaMessage) => Promise<ExecResult | void>] {
  const toast = useToast()
  const [api, pruntimeURL, selectedMethodSpec, contract, account, queryClient, signer] = useAtomValue(waitForAll([
    apiPromiseAtom,
    pruntimeURLAtom,
    currentMethodAtom,
    currentContractAtom,
    currentAccountAtom,
    queryClientAtom,
    signerAtom,
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
      const contractInstance = new ContractPromise(
        (await create({
          api: apiCopy,
          baseURL: pruntimeURL, contractId: contract.contractId, remotePubkey: remotePubkey,
          // enable autoDeposit to pay for gas fee
          autoDeposit: true
        })).api,
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
      const args = R.map(
        i => {
          const value = inputValues[i.label]
          return value
        },
        methodSpec.args
      )
      debug('args built: ', args)

      // The certificate is used in query and for gas estimation in tx.
      const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account))

      // tx
      if (methodSpec.mutates) {
        // const { signer } = await web3FromSource(account.meta.source)
        let txConf
        if (depositSettings.autoDeposit) {
          txConf = await estimateGas(contractInstance, txMethods[methodSpec.label], cert, args);
          debug('auto deposit: ', txConf)
        } else {
          txConf = R.pick(['gasLimit', 'storageDepositLimit'], depositSettings)
          debug('manual deposit: ', txConf)
        }
        const r1 = await signAndSend(
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
      if (api && signer && account && systemContractId && remotePubkey) {
        try {
          const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account))
          const result = await queryClient.fetchQuery(queryPinkLoggerContract(api, pruntimeURL, cert, systemContractId, remotePubkey))
          if (result) {
            const { sidevmQuery } = result
            const params = {
              action: 'GetLog',              contract: contract.contractId,
            }
            const raw = await sidevmQuery(stringToHex(JSON.stringify(params)) as unknown as Bytes, cert)
            const resp = api.createType('InkResponse', raw).toHuman() as unknown as InkResponse
            if (resp.result.Ok) {
              const response: PinkLoggerResposne = JSON.parse(resp.result.Ok.InkMessageReturn)
              response.records.forEach(r => {
                if (r.type == 'MessageOutput' && r.output.startsWith('0x')) {
                  try {
                    let decoded = api.createType('Result<ExecReturnValue, DispatchError>', r.output)
                    r.decoded = JSON.stringify(decoded.toHuman())
                  } catch {
                    console.info('Failed to decode MessageOutput', r.output)
                  }
                }
              })
              // console.log('response', response.records[0].output)
              // const lines = hexToString(resp.result.Ok.InkMessageReturn).trim().split('\n')
              setLogs(R.reverse(response.records))
            }
          }
        } catch (err) {
          console.error('PinkLogger failed: ', err)
        }
      }
      setIsLoading(false)
    }
  }, [
    api, pruntimeURL, contract, account, selectedMethodSpec, appendResult, dispatch, queryClient,
    signer, setLogs, systemContractId, currentArgsForm
  ])
  return [isLoading, fn]
}
