import { atom } from 'jotai'
import type { HeaderExtended } from '@polkadot/api-derive/types'
import { BlockNumber, EventRecord } from '@polkadot/types/interfaces'

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

export const lastHeadersAtom = atom<HeaderExtendedWithMapping[]>([])
export const recentBlocksAtom = atom(get => get(lastHeadersAtom).filter(header => !!header))

export const keyedEventsAtom = atom<KeyedEvent[]>([])
export const lastEventsAtom = atom(0)