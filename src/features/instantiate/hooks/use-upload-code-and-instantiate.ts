import { useCallback } from 'react'
import { atom } from 'jotai'
import { atomWithReset, useAtomValue, useUpdateAtom, useResetAtom } from 'jotai/utils'
import type { Signer as InjectedSigner } from '@polkadot/api/types';
import type { ApiTypes } from '@polkadot/api-base/types/base'
import type { SubmittableExtrinsic } from '@polkadot/api-base/types/submittable'
import type { Event as PolkadotEvent, EventRecord } from '@polkadot/types/interfaces/system'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import { web3FromSource } from '@polkadot/extension-dapp'
import { useToast } from '@chakra-ui/react'
import * as R from 'ramda'

import { rpcApiInstanceAtom, useConnectApi } from '@/atoms/foundation'
import { contractsAtom } from '@/features/fat-contract/atoms'

export const eventsAtom = atomWithReset<PolkadotEvent[]>([])

const dispatchEventAtom = atom(null, (get, set, events: EventRecord[]) => {
  const prev = get(eventsAtom)
  set(eventsAtom, [ ...R.reverse(events.map(i => i.event)), ...prev])
})

export const signAndSend = (target: SubmittableExtrinsic<ApiTypes>, address: string, signer: InjectedSigner) => {
  return new Promise(async (resolve, reject) => {
    // Ready -> Broadcast -> InBlock -> Finalized
    const unsub = await target.signAndSend(
      address, { signer }, (result) => {
        const humanized = result.toHuman()          
        if (result.status.isInBlock) {
          let error;
          for (const e of result.events) {
            const { event: { data, method, section } } = e;
            if (section === 'system' && method === 'ExtrinsicFailed') {
              error = data[0];
            }
          }
          // @ts-ignore
          unsub();
          if (error) {
            reject(error);
          } else {
            resolve({
              hash: result.status.asInBlock.toHuman(),
              // @ts-ignore
              events: result.toHuman().events,
            });
          }
        } else if (result.status.isInvalid) {
          // @ts-ignore
          unsub();
          reject('Invalid transaction');
        }
      }
    )
  })
}

export default function useUploadCodeAndInstantiate() {
  const api = useAtomValue(rpcApiInstanceAtom)
  const dispatch = useUpdateAtom(dispatchEventAtom)
  const reset = useResetAtom(eventsAtom)
  const toast = useToast()
  const saveContract = useUpdateAtom(contractsAtom)

  useConnectApi()

  return useCallback(async (account: InjectedAccountWithMeta, contract:ContractMetadata, clusterId: string) => {
    if (!api) {
      throw new Error('API instance is not ready yet.')
    }
    reset()
    const { signer } = await web3FromSource(account.meta.source)
    const r1 = await signAndSend(api.tx.phalaFatContracts.uploadCodeToCluster(contract.source.wasm, clusterId), account.address, signer)
    // @ts-ignore
    dispatch(r1.events)
    const salt = '0x' + new Date().getTime()
    const initSelector = contract.V3.spec.constructors.filter(c => c.label === 'default' || c.label === 'new')[0].selector
    const r2 = await signAndSend(
      api.tx.phalaFatContracts.instantiateContract(
        { 'WasmCode': contract.source.hash }, initSelector, salt, clusterId
      ),
      account.address, signer
    )
    // @ts-ignore
    dispatch(r2.events)
    // @ts-ignore
    const instantiateEvent = R.find(R.pathEq(['event', 'method'], 'Instantiating'), r2.events)
    if (instantiateEvent && instantiateEvent.event.data.length > 2) {
      const contractId = instantiateEvent.event.data[0]
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId} }))
    }
    toast({
      title: 'Instantiate Requested.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }, [api, dispatch, reset, toast, saveContract])
}