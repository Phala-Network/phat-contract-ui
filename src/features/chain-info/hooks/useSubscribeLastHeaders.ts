import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { UnsubscribePromise } from '@polkadot/api/types'
import { apiPromiseAtom } from '@/features/parachain/atoms'
import { HeaderExtendedWithMapping, lastHeadersAtom } from '../atoms'

const MAX_HEADERS = 75

export const useSubscribeLastHeaders = () => {
  const api = useAtomValue(apiPromiseAtom)
  const setLastHeaders = useSetAtom(lastHeadersAtom)

  useEffect(() => {
    let subscriber: UnsubscribePromise
    const init = async () => {
      await api.isReady

      let lastHeaders: HeaderExtendedWithMapping[] = []

      subscriber = api.derive.chain.subscribeNewHeads(lastHeader => {
        if (lastHeader?.number) {
          const blockNumber = lastHeader.number.unwrap()

          lastHeaders = lastHeaders
            .filter((old, index) => index < MAX_HEADERS && old.number.unwrap().lt(blockNumber))
            .reduce((next, header): HeaderExtendedWithMapping[] => {
              next.push(header)
              return next
            }, [lastHeader])
            .sort((a, b) => b.number.unwrap().cmp(a.number.unwrap()))

          setLastHeaders(lastHeaders)
        }
      })
    }

    init()

    return () => {
      subscriber?.then(unsubscribe => unsubscribe?.())
    }
  }, [api])
}