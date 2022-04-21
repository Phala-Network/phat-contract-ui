import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp'
import { keyring } from '@polkadot/ui-keyring'

import { rpcApiInstanceAtom } from '@/atoms/foundation'

export const extensionEnabledAtom = atom(false)

extensionEnabledAtom.onMount = (set) => {
  (async () => {
    try {
      const injected = await web3Enable('contracts-ui')
      console.log('injected', injected)
      if (injected.length > 0) {
        set(true)
      }
    } catch (error) {
      console.error(error)
    }
  })()
}

export const accountsAtom = atom(async (get) => {
  const enabled = get(extensionEnabledAtom)
  if (enabled) {
    try {
      const allAccounts = await web3Accounts();
      // @FIXME
      keyring.loadAll({ isDevelopment: true }, allAccounts);
      return allAccounts
    } catch (err) {
      console.log('[accountsAtom] load keyring failed with: ', err)
    }
  }
  return [] as InjectedAccountWithMeta[]
})

export const lastSelectedAccountAddressAtom = atomWithStorage('lastSelectedAccount', '')

export const lastSelectedAccountAtom = atom(
  get => {
    const accounts = get(accountsAtom)
    const addr = get(lastSelectedAccountAddressAtom)
    return accounts.find(account => account.address === addr) || null
  },
  (_, set, value?: InjectedAccountWithMeta) => {
    if (value) {
      set(lastSelectedAccountAddressAtom, value.address)
    }
  }
)

export const balanceAtom = atom(async (get) => {
  const api = get(rpcApiInstanceAtom)
  const selected = get(lastSelectedAccountAtom)
  if (!api || !selected) {
    return 0
  }
  // console.log(api.query.system)
  // console.log(selected)
  const account = await api.query.system.account(selected.address)
  // @ts-ignore
  const value = parseInt((BigInt(account.data.free.toString()) / BigInt(100000000)).toString(), 10) / 10000
  return value
})