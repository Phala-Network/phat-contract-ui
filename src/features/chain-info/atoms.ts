import { atom } from 'jotai'
import type { HeaderExtended } from '@polkadot/api-derive/types'
import { BlockNumber, EventRecord, Header } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import { xxhashAsHex } from '@polkadot/util-crypto'
import { stringify, stringToU8a } from '@polkadot/util'
import { switchMap, scan } from 'rxjs/operators'
import { from, map } from 'rxjs'
import { atomWithStreamSubscription } from './atomWithStreamSubscription'

const MAX_HEADERS = 75
const MAX_EVENTS = 75;

export interface HeaderExtendedWithMapping extends HeaderExtended {
  authorFromMapping?: string
}

export interface IndexedEvent {
  indexes: number[]
  record: EventRecord
}

export interface KeyedEvent extends IndexedEvent {
  blockHash?: string
  blockNumber?: BlockNumber
  key: string
}

export interface SystemEvents {
  lastEvents: number
  keyedEvents: KeyedEvent[]
}

interface PrevHashes {
  block: string | null
  event: string | null
}

const filterInEvents = ({
  prev,
  records,
  keyedEvents,
  header,
}: {
  prev: PrevHashes
  records: Vec<EventRecord>
  keyedEvents: KeyedEvent[]
  header: Header
}): KeyedEvent[] => {
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

      return newKeyedEvents
    }
  }

  return keyedEvents
}

export const lastHeadersAtom = atomWithStreamSubscription<HeaderExtendedWithMapping, HeaderExtendedWithMapping[]>({
  createSubscriber: (api, get, handler) => {
    return api.derive.chain.subscribeNewHeads(handler)
  },
  createCombinedObservable: (api, get, sourceObservable) => {
    return sourceObservable
      .pipe(
        scan((lastHeaders, lastHeader) => {
          if (lastHeader?.number) {
            const blockNumber = lastHeader.number.unwrap()

            return lastHeaders
              .filter((old, index) => index < MAX_HEADERS && old.number.unwrap().lt(blockNumber))
              .reduce((next, header): HeaderExtendedWithMapping[] => {
                next.push(header)
                return next
              }, [lastHeader])
              .sort((a, b) => b.number.unwrap().cmp(a.number.unwrap()))
          }
          return lastHeaders
        }, [] as HeaderExtendedWithMapping[])
      )
  },
  options: {
    initialValue: []
  }
})
export const recentBlocksAtom = atom(get => get(lastHeadersAtom).filter(header => !!header))

let defaultSystemEvents: SystemEvents = {
  lastEvents: 0,
  keyedEvents: [],
}

export const systemEventsAtom = atomWithStreamSubscription<Vec<EventRecord>, SystemEvents>({
  createSubscriber: (api, get, handler) => {
    return api.query.system.events(handler)
  },
  createCombinedObservable: (api, get, sourceObservable) => {
    const prevHashes: PrevHashes = { block: null, event: null }

    return sourceObservable
      .pipe(
        switchMap(records => from(
          api.rpc.chain.getHeader(records.createdAtHash)
        ).pipe(
          map(header => ({
            header,
            records,
          })),
        )),
        scan((prevSystemEvents, recordsAndHeader) => {
          const { records, header } = recordsAndHeader

          const keyedEvents = filterInEvents({
            prev: prevHashes,
            records,
            keyedEvents: prevSystemEvents.keyedEvents,
            header: header as unknown as Header,
          })

          return {
            lastEvents: records.length,
            keyedEvents,
          }
        }, defaultSystemEvents),
      )
  },
  options: {
    initialValue: defaultSystemEvents,
  },
})
export const keyedEventsAtom = atom(get => get(systemEventsAtom).keyedEvents)
export const lastEventsAtom = atom(get => get(systemEventsAtom).lastEvents)
