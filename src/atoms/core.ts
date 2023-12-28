import { atom } from 'jotai'
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

export const isEvmMappingPalletSupportedAtom = atom(get => {
  const state = get(loadable(phatRegistryAtom))
  if (state?.state === 'hasData' && state.data) {
    return !!(state.data.api.consts?.evmAccountMapping?.eip712Name)
  }
  return false
})
