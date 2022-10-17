import type {Bytes} from '@polkadot/types-codec'

import { useState, useCallback } from 'react'
import { useAtomValue, useSetAtom } from "jotai"
import { waitForAll } from "jotai/utils"
import { queryClientAtom } from 'jotai/query'
import { ContractPromise } from '@polkadot/api-contract'
import { hexToString } from '@polkadot/util'
import * as R from 'ramda'

import { create, createPruntimeApi } from '../../../sdk'
import createLogger from "@/functions/createLogger"
import { blockBarrier } from '@/functions/polling'
import signAndSend from '@/functions/signAndSend'

import { apiPromiseAtom, dispatchEventAtom } from '@/features/parachain/atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import { querySignCertificate } from '@/features/identity/queries'

import { pruntimeURLAtom, currentMethodAtom, currentContractAtom, dispatchResultsAtom, pinkLoggerContractIdAtom, pinkLoggerResultAtom } from '../atoms'

interface InkResponse {
  nonce: string
  result: {
    Ok?: {
      InkMessageReturn: string
    }
  }
}

const debug = createLogger('chain', 'debug')

export default function useContractExecutor(): [boolean, (inputs: Record<string, unknown>, overrideMethodSpec?: ContractMetaMessage) => Promise<void>] {
  const [api, pruntimeURL, selectedMethodSpec, contract, account, queryClient, signer] = useAtomValue(waitForAll([
    apiPromiseAtom,
    pruntimeURLAtom,
    currentMethodAtom,
    currentContractAtom,
    currentAccountAtom,
    queryClientAtom,
    signerAtom,
  ]))
  const pinkLoggerContractId = useAtomValue(pinkLoggerContractIdAtom)
  const appendResult = useSetAtom(dispatchResultsAtom)
  const dispatch = useSetAtom(dispatchEventAtom)
  const setLogs = useSetAtom(pinkLoggerResultAtom)
  const [isLoading, setIsLoading] = useState(false)

  const fn = useCallback(async (inputs: Record<string, unknown>, overrideMethodSpec?: ContractMetaMessage) => {
    setIsLoading(true)
    const methodSpec = overrideMethodSpec || selectedMethodSpec
    try {
      if (!api || !account || !methodSpec || !signer) {
        debug('contractInstance or account is null')
        return
      }
      console.log('contract', contract)
      const apiCopy = await api.clone().isReady
      const contractInstance = new ContractPromise(
        (await create({api: apiCopy, baseURL: pruntimeURL, contractId: contract.contractId})).api,
        contract.metadata,
        contract.contractId
      )
      debug('methodSpec', methodSpec)

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
        i => inputs[i.label],
        methodSpec.args
      )
      debug('args built: ', args)

      // tx
      if (methodSpec.mutates) {
        // const { signer } = await web3FromSource(account.meta.source)
        const r1 = await signAndSend(
          contractInstance.tx[txMethods[methodSpec.label]]({}, ...args),
          account.address,
          signer
        )
        // @ts-ignore
        dispatch(r1.events)
        debug('result: ', r1)
        // const prpc = await createPruntimeApi(pruntimeURL)
        const prpc = createPruntimeApi(pruntimeURL)
        console.log('prpc', prpc)
        await blockBarrier(contractInstance.api, prpc)
      }
      // query
      else {
        const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account))
        // const cert = await queryClient.fetchQuery(['queryContractCert', account.address], async () => {
        //   const { signer } = await web3FromSource(account.meta.source)
        //   // @ts-ignore
        //   return await signCertificate({signer, account, api: contractInstance.api as ApiPromise})
        // }, {
        //   staleTime: 1000 * 60 * 15, // 15 minutes
        // })
        const queryResult = await contractInstance.query[queryMethods[methodSpec.label]](
          // @FIXME this is a hack to make the ts compiler happy.
          cert as unknown as string,
          // querySignCache as unknown as string,
          { value: 0, gasLimit: -1 },
          ...args
        )
        // debug('query result: ', queryResult)
        // @TODO Error handling
        if (queryResult.result.isOk) {
          appendResult({
            contract,
            methodSpec,
            succeed: true,
            args: inputs,
            output: queryResult.output?.toHuman(),
            completedAt: Date.now(),
          })
        } else {
          appendResult({
            contract,
            methodSpec,
            succeed: false,
            args: inputs,
            output: queryResult.result.toHuman(),
            completedAt: Date.now(),
          })
        }
      }
    } finally {
      if (api && signer && account && pinkLoggerContractId) {
        const cert = await queryClient.fetchQuery(querySignCertificate(api, signer, account))
        const { sidevmQuery } = await create({
          api: await api.clone().isReady,
          baseURL: pruntimeURL,
          contractId: pinkLoggerContractId,
        })
        const raw = await sidevmQuery('' as unknown as Bytes, cert)
        const resp = api.createType('InkResponse', raw).toHuman() as unknown as InkResponse
        if (resp.result.Ok) {
          const lines = hexToString(resp.result.Ok.InkMessageReturn).trim().split('\n')
          setLogs(lines)
        }
      }
      setIsLoading(false)
    }
  }, [
    api, pruntimeURL, contract, account, selectedMethodSpec, appendResult, dispatch, queryClient,
    signer, pinkLoggerContractId, setLogs,
  ])
  return [isLoading, fn]
}