import { useCallback } from 'react'
import { useAtomValue } from 'jotai/utils'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import type { ISubmittableResult } from '@polkadot/types/types';
import { web3FromSource } from '@polkadot/extension-dapp'

import { rpcEndpointAtom, rpcApiInstanceAtom, useConnectApi } from '@/atoms/foundation'

export default function useUploadCodeAndInstantiate() {
  // const endpoint = useAtomValue(rpcEndpointAtom)
  const api = useAtomValue(rpcApiInstanceAtom)

  useConnectApi()

  return useCallback(async (account: InjectedAccountWithMeta, contract:ContractMetadata, clusterId: string) => {
    if (!api) {
      throw new Error('API instance is not ready yet.')
    }
    const { signer } = await web3FromSource(account.meta.source)
  
    const r1 = await new Promise(async (resolve, reject) => {
      // Ready -> Broadcast -> InBlock -> Finalized
      const unsub = await api.tx.phalaFatContracts.uploadCodeToCluster(contract.source.wasm, clusterId).signAndSend(
        account.address, { signer },  (result) => {
          const humanized = result.toHuman()
          // @ts-ignore
          console.log('uploadCodeToCluster', result.status.type, humanized.status)
          
          if (result.status.isInBlock) {
            let error;
            for (const e of result.events) {
              const { event: { data, method, section } } = e;
              if (section === 'system' && method === 'ExtrinsicFailed') {
                error = data[0];
              }
            }
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
            unsub();
            // resolve();
            reject('Invalid transaction');
          }
        }
      )
    })
    console.log('uploadCodeToCluster result:', r1)
    
    const salt = '0x' + new Date().getTime()
    // const initSelector = '0xed4b9d1b'
    const initSelector = contract.V3.spec.constructors.filter(c => c.label === 'default')[0].selector

    const r2 = await new Promise(async (resolve, reject) => {
      const unsub = await api.tx.phalaFatContracts.instantiateContract(
        { 'WasmCode': contract.source.hash }, initSelector, salt, clusterId
      ).signAndSend(
        account.address, { signer }, (result) => {
          const humanized = result.toHuman()
          // @ts-ignore
          console.log('instantiateContract', result.status.type, humanized.status)

          if (result.status.isInBlock) {
            let error;
            for (const e of result.events) {
              const { event: { data, method, section } } = e;
              if (section === 'system' && method === 'ExtrinsicFailed') {
                error = data[0];
              }
            }
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
            unsub();
            // resolve();
            reject('Invalid transaction');
          }
        }
      )
    })
    console.log('instantiateContract result:', r1)

  }, [api])
}