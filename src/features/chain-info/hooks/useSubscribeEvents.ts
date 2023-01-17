import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Vec } from '@polkadot/types'
import { BlockNumber, EventRecord } from '@polkadot/types/interfaces'
import { UnsubscribePromise } from '@polkadot/api/types'
import { ApiPromise } from '@polkadot/api'
import { xxhashAsHex } from '@polkadot/util-crypto'
import { apiPromiseAtom } from '@/features/parachain/atoms'
import { lastEventsAtom, keyedEventsAtom, KeyedEvent, IndexedEvent } from '../atoms'
import { stringify, stringToU8a } from '@polkadot/util'

const MAX_EVENTS = 75;

interface PrevHashes {
  block: string | null
  event: string | null
}

interface FilterInEvents {
  isModified: boolean
  keyedEvents: KeyedEvent[]
}

const asyncFilterInEvents = async (api: ApiPromise, prev: PrevHashes, records: Vec<EventRecord>, keyedEvents: KeyedEvent[]): Promise<FilterInEvents> => {
  // 1. 整理出新的事件列表
  const newEvents: IndexedEvent[] = records
    .map((record, index) => ({ indexes: [index], record }))
    // 过滤掉一些 record
    .filter(({ record: { event: { method, section } } }) =>
      section !== 'system' &&
      (
        !['balances', 'treasury'].includes(section) ||
        !['Deposit', 'Withdraw'].includes(method)
      ) &&
      (
        !['transactionPayment'].includes(section) ||
        !['TransactionFeePaid'].includes(method)
      ) &&
      (
        !['paraInclusion', 'parasInclusion', 'inclusion'].includes(section) ||
        !['CandidateBacked', 'CandidateIncluded'].includes(method)
      ) &&
      (
        !['relayChainInfo'].includes(section) ||
        !['CurrentBlockNumbers'].includes(method)
      )
    )
    // 将重复的 record 合并，并将索引放到 indexes 中去
    .reduce((combined: IndexedEvent[], e): IndexedEvent[] => {
      const prev = combined.find(({ record: { event: { method, section } } }) =>
        e.record.event.section === section &&
        e.record.event.method === method
      )

      if (prev) {
        prev.indexes.push(...e.indexes)
      } else {
        combined.push(e)
      }

      return combined
    }, [])
    // 倒序
    .reverse()

  // 2. 将事件列表 hash 一下，方便与之前的事件列表进行比较
  const newEventHash = xxhashAsHex(stringToU8a(stringify(newEvents)))

  // 3. 事件列表不为空数组且与之前的不同
  if (newEventHash !== prev.event && newEvents.length) {
    // 将现在的事件列表 hash 赋值给 prev 的标志
    prev.event = newEventHash;

    // retrieve the last header, this will map to the current state
    const header = await api.rpc.chain.getHeader(records.createdAtHash);
    const blockNumber = header.number.unwrap() as unknown as BlockNumber;
    const blockHash = header.hash.toHex();

    // 这次存储事件列表的块不在原来的块
    if (blockHash !== prev.block) {
      prev.block = blockHash;

      const newKeyedEvents: KeyedEvent[] = [
        ...newEvents.map(({ indexes, record }): KeyedEvent => ({
          blockHash,
          blockNumber,
          indexes,
          key: `${blockNumber.toNumber()}-${blockHash}-${indexes.join('.')}`,
          record
        })),
        // remove all events for the previous same-height blockNumber
        ...keyedEvents.filter((p) => !p.blockNumber?.eq(blockNumber))
      ].slice(0, MAX_EVENTS)

      return {
        isModified: true,
        keyedEvents: newKeyedEvents,
      }
    }
  }

  return {
    isModified: false,
    keyedEvents,
  }
}

export const useSubscribeEvents = () => {
  const api = useAtomValue(apiPromiseAtom)
  const [keyedEvents, setKeyedEvents] = useAtom(keyedEventsAtom)
  const setLastEvents = useSetAtom(lastEventsAtom)
  const prevHashes = useRef<PrevHashes>({ block: null, event: null })

  useEffect(() => {
    let subscriber: UnsubscribePromise
    const init = async () => {
      await api.isReady
      subscriber = api.query.system.events((records: Vec<EventRecord>) => {
        if (records) {
          setLastEvents(records.length)

          asyncFilterInEvents(api, prevHashes.current, records, keyedEvents)
            .then(result => {
              const { isModified, keyedEvents: newKeyedEvents } = result
              if (isModified) {
                setKeyedEvents(newKeyedEvents)
              }
            })
            .catch(console.error)
        }
      })
    }
    init()
    return () => {
      subscriber?.then(unsubscribe => (unsubscribe as unknown as Function)())
    }
  }, [api, prevHashes, keyedEvents])
}