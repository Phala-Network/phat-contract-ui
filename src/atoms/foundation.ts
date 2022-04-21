import type { Vec, Bytes } from '@polkadot/types'
import type { Codec } from '@polkadot/types/types'
import type { EventRecord, BlockNumber } from '@polkadot/types/interfaces'
import type { KeyringItemType, KeyringJson$Meta } from '@polkadot/ui-keyring/types'
import type { TypeDef } from '@polkadot/types-create/types'
import type { AbiEvent } from '@polkadot/api-contract/types'

import { useEffect, useRef } from 'react'
import { atom, useAtom } from 'jotai'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'
import * as R from 'ramda'

import { Abi } from '@polkadot/api-contract'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { stringify, stringToU8a } from '@polkadot/util'
import { keyring } from '@polkadot/ui-keyring'
import { xxhashAsHex } from '@polkadot/util-crypto'
import { khalaDev } from '@phala/typedefs'
import { types as phalaSDKTypes } from '@phala/sdk'

export const rpcEndpointAtom = atom('')

export const rpcEndpointErrorAtom = atom('')

export const rpcApiInstanceAtom = atom<ApiPromise | null>(null)

export const createApiInstance = (endpointUrl: string): [WsProvider, ApiPromise] => {
  console.log('create RPC connection to ', endpointUrl)
  const wsProvider = new WsProvider(endpointUrl)
  const api = new ApiPromise({
    provider: wsProvider,
    types: {
      ...khalaDev,
      ...phalaSDKTypes,
    },
  })
  return [wsProvider, api]
}

type ApiConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export const rpcApiStatusAtom = atom<ApiConnectionStatus>('disconnected')

export const useConnectApi = () => {
  const [endpointUrl, setEndpointUrl] = useAtom(rpcEndpointAtom)
  const setStatus = useUpdateAtom(rpcApiStatusAtom)
  const setApiInstance = useUpdateAtom(rpcApiInstanceAtom)
  const setError = useUpdateAtom(rpcEndpointErrorAtom)
  useEffect(() => {
    setError('')
    if (!endpointUrl) {
      console.log('setStatus -> disconnected')
      setStatus('disconnected')
      setApiInstance(null)
    } else {
      console.log('setStatus -> connecting')
      setStatus('connecting')

      const fn = async () => {
        const [ws, api] = createApiInstance(endpointUrl)

        ws.on('error', (error) => {
          const isFirefox = window.navigator.userAgent.indexOf('Firefox') !== -1
          setApiInstance(null)
          setEndpointUrl('')
          console.log(new Date(), 'setStatus -> error')
          if (isFirefox) {
            setError('RPC Endpoint is unreachable. If you are using Firefox, please switch to Chrome and try again.')
          } else {
            setError('RPC Endpoint is unreachable.')
          }
        })

        api.on('connected', async () => {
          await api.isReady
          setStatus('connected')
          console.log(new Date(), 'setStatus -> connected')
        })

        api.on('disconnected', () => {
          console.log(new Date(), 'setStatus -> disconnected')
          setStatus((prev) => prev === 'error' ? prev : 'disconnected')
          setEndpointUrl('')
        })
  
        api.on('ready', () => console.log(new Date(), 'API ready'))
  
        const onError = (err: unknown) => {
          console.log(new Date(), 'api error', err)
          setStatus('error')
          setError(`RPC Error`)
          setApiInstance(null)
          setEndpointUrl('')
          api.off('error', onError)
          try {
            api.disconnect()
            ws.disconnect()
          } catch (err1) {
            console.log('hey yo', err1)
          }
        }
        api.on('error', onError)

        setTimeout(() => {
          setStatus(prev => {
            if (prev !== 'connected') {
              setApiInstance(null)
              setEndpointUrl('')
              console.log(new Date(), 'setStatus -> error')
              setError('RPC Endpoint is unreachable')
              return 'error'
            }
            return prev
          })
        }, 10000)

        await api.isReady
        setApiInstance(api)
      }

      try {
        fn()
      } catch (err) {
        console.log('error', err)
      }
    }
  }, [endpointUrl, setEndpointUrl, setStatus, setApiInstance, setError])
}

//
//
//

const MAX_EVENTS = 75;

export interface IndexedEvent {
  indexes: number[];
  record: EventRecord;
}

export interface KeyedEvent extends IndexedEvent {
  blockHash?: string;
  blockNumber?: BlockNumber;
  key: string;
}

interface PrevHashes {
  block: string | null;
  event: string | null;
}

export const systemEventsAtom = atom<{
  eventCount: number;
  events: KeyedEvent[];
}>({ eventCount: 0, events: [] })

export function getAddressMeta (address: string, type: KeyringItemType | null = null): KeyringJson$Meta {
  let meta: KeyringJson$Meta | undefined;

  try {
    const pair = keyring.getAddress(address, type);

    meta = pair && pair.meta;
  } catch (error) {
    // we could pass invalid addresses, so it may throw
  }

  return meta || {};
}

export function getContractAbi (api: ApiPromise, address: string | null): Abi | null {
  if (!address) {
    return null;
  }

  let abi: Abi | undefined;
  const meta = getAddressMeta(address, 'contract');

  try {
    const data = (meta.contract && JSON.parse(meta.contract.abi)) as string;

    abi = new Abi(data, api.registry.getChainProperties());
  } catch (error) {
    console.error(error);
  }

  return abi || null;
}

export type RecentSystemEvent = {
  event: KeyedEvent;
  details: {
    abiEvent: {
      values: {
          isValid: boolean;
          value: Codec;
      }[];
      args: Codec[];
      event: AbiEvent;
    } | null;
    params: {
      type: TypeDef;
    }[];
    values: {
      isValid: boolean;
      value: Codec;
    }[];
  }
}

export const recentSystemEventsAtom = atom<RecentSystemEvent[]>(get => {
  const api = get(rpcApiInstanceAtom)
  if (!api) {
    return [] as RecentSystemEvent[]
  }
  const { events } = get(systemEventsAtom)
  return events.map(event => {
    const value = event.record.event
    const params = value.typeDef.map((type) => ({ type }))
    const values = value.data.map((value) => ({ isValid: true, value }))
    if (value.section === 'contracts' && value.method === 'ContractExecution' && value.data.length === 2) {
      // see if we have info for this contract
      const [accountId, encoded] = value.data

      try {
        const abi = getContractAbi(api, accountId.toString())

        if (abi) {
          const decoded = abi.decodeEvent(encoded as Bytes)

          const abiEvent = {
            ...decoded,
            values: decoded.args.map((value) => ({ isValid: true, value }))
          }
          return {
            event,
            details: { abiEvent, params, values }
          } as unknown as RecentSystemEvent
        }
      } catch (error) {
        // ABI mismatch?
        console.error(error);
      }
    }
    return {
      event,
      details: { abiEvent: null, params, values }
    } as RecentSystemEvent
  })
})

export function useSystemEvents() {
  const setEvents = useUpdateAtom(systemEventsAtom)
  const api = useAtomValue(rpcApiInstanceAtom)
  const prevHashes = useRef({ block: null, event: null });

  useEffect(() => {
    if (api) {
      const unsubscribe = api.query.system.events(async (records: Vec<EventRecord>) => {
        const newEvents: IndexedEvent[] = records
          .map((record, index) => ({ indexes: [index], record }))
          .filter(({ record: { event: { method, section } } }) =>
            section !== 'system' &&
            (!['balances', 'treasury'].includes(section) || !['Deposit'].includes(method)) &&
            (!['parasInclusion', 'inclusion'].includes(section) || !['CandidateBacked', 'CandidateIncluded'].includes(method))
          )
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
          .reverse()
        const newEventHash = xxhashAsHex(stringToU8a(stringify(newEvents)))
        const prev: PrevHashes = prevHashes.current
  
        if (newEventHash !== prev.event && newEvents.length) {
          prev.event = newEventHash;
  
          // retrieve the last header, this will map to the current state
          const header = await api.rpc.chain.getHeader(records.createdAtHash);
          const blockNumber = header.number.unwrap();
          const blockHash = header.hash.toHex();
  
          if (blockHash !== prev.block) {
            prev.block = blockHash;
  
            setEvents(({ events }) => ({
              eventCount: records.length,
              events: [
                ...newEvents.map(({ indexes, record }): KeyedEvent => ({
                  blockHash,
                  blockNumber: blockNumber as unknown as BlockNumber,
                  indexes,
                  key: `${blockNumber.toNumber()}-${blockHash}-${indexes.join('.')}`,
                  record
                })),
                // remove all events for the previous same-height blockNumber
                ...events.filter((p) => !p.blockNumber?.eq(blockNumber))
              ].slice(0, MAX_EVENTS)
            }));
          }
        } else {
          setEvents(({ events }) => ({
            eventCount: records.length,
            events
          }));
        }
      })

      return () => {
        unsubscribe.then((fn) => R.is(Function, fn) && fn())
      }
    }
  }, [api, setEvents])
}