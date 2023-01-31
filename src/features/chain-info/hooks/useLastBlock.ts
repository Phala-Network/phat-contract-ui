import { useEffect, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { UnsubscribePromise } from '@polkadot/api/types'
import { Moment } from '@polkadot/types/interfaces'
import { apiPromiseAtom } from '@/features/parachain/atoms'

const LOCAL_UPDATE_TIME = 100;

// time's unit is second
export const formatTime = (time: number, type: 's' | 'min' | 'hr' = 's') => {
  let timeFormatted = time
  
  switch (type) {
    case 's':
      timeFormatted = time
      break

    case 'min':
      timeFormatted = time / 60
      break
  
    case 'hr':
      timeFormatted = time / 60 / 60
      break

    default:
      break

  }
  
  return timeFormatted.toFixed(1) + type
}

// The local time, will update frequently
export const useLocalNow = (): number => {
  const [localNow, setLocalNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalNow(Date.now())
    }, LOCAL_UPDATE_TIME)
    return () => {
      clearInterval(timer)
    }
  })

  return localNow
}

// The remote last block create time
export const useLastBlockTime = (): number | undefined => {
  const api = useAtomValue(apiPromiseAtom)
  const [lastBlockTime, setLastBlockTime] = useState<Moment>()

  useEffect(() => {
    let subscriber: UnsubscribePromise
    const init = async () => {
      await api.isReady
      subscriber = api.query.timestamp?.now((moment: Moment) => {
        setLastBlockTime(moment)
      }) as unknown as UnsubscribePromise
    }

    init()
    return () => {
      subscriber?.then(unsubscribe => unsubscribe?.()).catch(_ => _)
    }
  })

  return lastBlockTime?.toNumber()
}

// Last block is a proper noun,
// it means the duration from the last block create time to now,
// learn more from https://cloudflare-ipfs.com/ipns/dotapps.io/#/explorer
export const useLastBlock = (): string => {
  const localNow = useLocalNow()
  const lastBlockTime = useLastBlockTime()

  const lastBlock = useMemo(() => {
    if (!lastBlockTime) {
      return '0s'
    }
  
    // time unit is second
    const fromCreateToNowTime = Math.max(Math.abs(localNow - lastBlockTime), 0) / 1000;
    return formatTime(fromCreateToNowTime)
  }, [localNow, lastBlockTime])

  return lastBlock
}