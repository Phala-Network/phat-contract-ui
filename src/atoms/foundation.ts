import { useEffect } from 'react'
import { atom, useAtom } from 'jotai'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'

import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import { web3Accounts, web3Enable } from '@polkadot/extension-dapp'
import { keyring } from '@polkadot/ui-keyring'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { ContractPromise } from '@polkadot/api-contract'
import { khalaDev } from '@phala/typedefs'
import { types as phalaSDKTypes } from '@phala/sdk'

export const injectedExtensionsFoundAtom = atom(async () => {
  try {
    const injected = await web3Enable('contracts-ui')
    return injected.length > 0
  } catch (error) {
    return false
  }
})

export const rpcEndpointAtom = atom('')

export const rpcEndpointErrorAtom = atom('')

export const rpcApiInstanceAtom = atom<ApiPromise | null>(null)

export const createApiInstance = (endpointUrl: string): [WsProvider, ApiPromise] => {
  console.log('create RPC connection to ', endpointUrl)
  const wsProvider = new WsProvider(endpointUrl);
  const api = new ApiPromise({
    provider: wsProvider,
    types: {
      ...khalaDev,
      ...phalaSDKTypes,
    },
  });
  return [wsProvider, api]
}

type ApiConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export const rpcApiStatusAtom = atom<ApiConnectionStatus>('disconnected')

export const useConnectApi = () => {
  const [endpointUrl, setEndpointUrl] = useAtom(rpcEndpointAtom)
  const setStatus = useUpdateAtom(rpcApiStatusAtom)
  const setApiInstance = useUpdateAtom(rpcApiInstanceAtom)
  const setError = useUpdateAtom(rpcEndpointErrorAtom)
  useEffect(() => {
    setError('')
    if (!endpointUrl) {
      console.log('setStatus -> disconnected')
      setStatus('disconnected')
      setApiInstance(null)
    } else {
      console.log('setStatus -> connecting')
      setStatus('connecting')

      const fn = async () => {
        const [ws, api] = createApiInstance(endpointUrl)

        api.on('connected', async () => {
          await api.isReady
          setStatus('connected')
          console.log(new Date(), 'setStatus -> connected')
        })

        api.on('disconnected', () => {
          console.log(new Date(), 'setStatus -> disconnected')
          setStatus((prev) => prev === 'error' ? prev : 'disconnected')
          setEndpointUrl('')
        })
  
        api.on('ready', () => console.log(new Date(), 'API ready'))
  
        const onError = (err: unknown) => {
          console.log(new Date(), 'api error', err)
          setStatus('error')
          setError(`RPC Error`)
          setApiInstance(null)
          setEndpointUrl('')
          api.off('error', onError)
          try {
            api.disconnect()
            ws.disconnect()
          } catch (err1) {
            console.log('hey yo', err1)
          }
        }
        api.on('error', onError)

        setTimeout(() => {
          setStatus(prev => {
            console.log(new Date(), 'timeout, let\'s check', prev)
            if (prev !== 'connected') {
              setApiInstance(null)
              setEndpointUrl('')
              console.log(new Date(), 'setStatus -> error')
              setError('RPC Endpoint is unreachable')
              return 'error'
            }
            return prev
          })
        }, 3000)

        await api.isReady
        setApiInstance(api)
      }

      try {
        fn()
      } catch (err) {
        console.log('error', err)
      }
    }
  }, [endpointUrl, setEndpointUrl, setStatus, setApiInstance, setError])
}