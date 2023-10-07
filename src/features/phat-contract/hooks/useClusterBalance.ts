import { useCallback, useEffect } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { signAndSend } from '@phala/sdk'
import { type Decimal } from 'decimal.js'
import type { Result, U64 } from '@polkadot/types'

import { currentAccountAtom, signerAtom, } from '@/features/identity/atoms'
import { phatRegistryAtom, cachedCertAtom } from '../atoms'


export const currentClusterBalanceAtom = atom(0)

export const isUpdatingClusterBalanceAtom = atom(false) 


export function useClusterBalance() {
  const [currentBalance, setCurrentBalance] = useAtom(currentClusterBalanceAtom)
  const [isLoading, setIsLoading] = useAtom(isUpdatingClusterBalanceAtom)

  const [,cert] = useAtomValue(cachedCertAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)

  const getBalance = useCallback(async () => {
    if (!registry || !currentAccount || !cert) {
      return { total: 0, free: 0 }
    }
    const { address } = currentAccount
    const system = registry.systemContract
    if (!system) {
      return { total: 0, free: 0 }
    }
    try {
      const { output: totalBalanceOf } = await system.query['system::totalBalanceOf'](address, { cert }, address)
      const { output: freeBalanceOf } = await system.query['system::freeBalanceOf'](address, { cert }, address)
      const total = (totalBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      const free = (freeBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      return { total, free }
    } catch (err) {
      return { total: 0, free: 0 }
    }
  }, [registry, currentAccount, cert])

  const refreshBalance = useCallback(async () => {
    setIsLoading(true)
    const result = await getBalance()
    setCurrentBalance(result.free)
    setIsLoading(false)
  }, [getBalance, setCurrentBalance, setIsLoading])

  useEffect(() => {
    (async function() {
      setIsLoading(true)
      const result = await getBalance()
      setCurrentBalance(result.free)
      setIsLoading(false)
    })();
  }, [getBalance])

  const transfer = useCallback(async (value: Decimal) => {
    if (!currentAccount || !signer) {
      return
    }
    const rounded = Number(value.mul(1e12).toFixed(0)) + 1
    setIsLoading(true)
    try {
      const { address } = currentAccount
      await signAndSend(registry.transferToCluster(address, rounded), address, signer)
      // @FIXME wait for next block
      await new Promise(resolve => setTimeout(resolve, 5000))
      await refreshBalance()
    } finally {
      setIsLoading(false)
    }
  }, [registry, currentAccount, signer, setCurrentBalance, setIsLoading, refreshBalance])

  return { currentBalance, isLoading, transfer, getBalance, refreshBalance }
}

