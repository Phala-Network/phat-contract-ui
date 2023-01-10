import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import type { HeaderExtended } from '@polkadot/api-derive/types'
import { apiPromiseAtom } from '@/features/parachain/atoms'

export const useHeader = (blockHash?: string) => {
  const api = useAtomValue(apiPromiseAtom)
  const [header, setHeader] = useState<HeaderExtended>()

  useEffect(() => {
    const initHeader = async () => {
      await api.isReady
      const headerInfo = await api.rpc.chain.getHeader(blockHash)
      console.log('headerInfo', headerInfo);
      setHeader(headerInfo as HeaderExtended)
    }

    initHeader()
  }, [api, blockHash])

  return header
}

export const getDisplayBlockNumber = (number?: number) => {
  return typeof number === 'undefined' ? '' : String(number)
}
export const useBlockNumber = (blockHash?: string) => {
  const header = useHeader(blockHash)
  const number = header?.number.toNumber()
  return number
}