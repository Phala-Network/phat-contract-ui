import { useState, useEffect } from 'react'
import { atom, useAtomValue } from 'jotai'
import { loadable } from "jotai/utils"
import type { OnChainRegistry } from '@phala/sdk'

import { phatRegistryAtom } from '@/features/phat-contract/atoms'
import { type ConnectState } from '@/features/phala-web/atomWithConnectState'
import { atomWithInjectedWallet } from '@/features/phala-web/atomWithInjectedWallet'

const bridgedClientAtom = atom(get => {
  const state = get(loadable(phatRegistryAtom))
  return {
    connected: state?.state === 'hasData',
    connecting: state?.state === 'loading',
    instance: state?.state === 'hasData' ? state.data : undefined,
  } as ConnectState<OnChainRegistry>
})

export const injectedWalletAtom = atomWithInjectedWallet('Phat Contracts UI', bridgedClientAtom)

//
// TODO: switch to SDK built-in solution.
//
export const isEvmMappingPalletSupportedAtom = atom(get => {
  const state = get(loadable(phatRegistryAtom))
  if (state?.state === 'hasData' && state.data) {
    return !!(state.data.api.consts?.evmAccountMapping?.eip712Name)
  }
  return false
})

//
//
//

export function useCurrentAccountBalance() {
  const { instance } = useAtomValue(bridgedClientAtom)
  const { provider, lastSelectedAddress } = useAtomValue(injectedWalletAtom)
  const [balance, setBalance] = useState(BigInt(0))

  useEffect(() => {
    let unsub: Function | null = null
    if (instance) {
      const addr = provider?.address || lastSelectedAddress
      if (addr) {
        !(async function () {
          unsub = await instance.api.query.system.account(addr, ({ data: { free: freeBalance } }) => {
            setBalance(freeBalance.toBigInt())
          })
        })();
      } else {
        setBalance(BigInt(0))
      }
    } else {
      setBalance(BigInt(0))
    }
    return () => {
      unsub?.()
    }
  }, [instance, provider, lastSelectedAddress, setBalance])

  return balance
}
