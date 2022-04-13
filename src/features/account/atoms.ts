import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import { web3Accounts } from '@polkadot/extension-dapp'
import { keyring } from '@polkadot/ui-keyring'

import { injectedExtensionsFoundAtom } from '@/atoms/foundation'

export const accountsAtom = atom(async (get) => {
  try {
    const isInjected = get(injectedExtensionsFoundAtom)
    if (isInjected) {
      const allAccounts = await web3Accounts();
      // @FIXME
      keyring.loadAll({ isDevelopment: true }, allAccounts);
      return allAccounts
    }
  } catch (err) {
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