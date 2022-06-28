import type { ApiTypes } from '@polkadot/api-base/types/base'
import type { Vec, Bytes } from '@polkadot/types'
import type { Codec } from '@polkadot/types/types'
import type { SubmittableExtrinsic } from '@polkadot/api-base/types/submittable'
import type { Event as PolkadotEvent, EventRecord } from '@polkadot/types/interfaces/system'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import type { Signer as InjectedSigner } from '@polkadot/api/types'
import type { BlockNumber } from '@polkadot/types/interfaces'
import type { KeyringItemType, KeyringJson$Meta } from '@polkadot/ui-keyring/types'
import type { TypeDef } from '@polkadot/types-create/types'
import type { AbiEvent } from '@polkadot/api-contract/types'

import { useState, useCallback, useEffect, useRef } from 'react'
import { atom, useAtom } from 'jotai'
import { atomWithStorage, atomWithReset, useAtomValue, useUpdateAtom, useResetAtom } from 'jotai/utils'
import { ContractPromise } from '@polkadot/api-contract'
import { Abi } from '@polkadot/api-contract'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { stringify, stringToU8a } from '@polkadot/util'
import { keyring } from '@polkadot/ui-keyring'
import { xxhashAsHex } from '@polkadot/util-crypto'
import { khalaDev } from '@phala/typedefs'

import { web3FromSource } from '@polkadot/extension-dapp'
import { useToast } from '@chakra-ui/react'
import * as R from 'ramda'

import { lastSelectedAccountAtom } from '@/features/account/atoms'

import { create, types as phalaSDKTypes } from '../../sdk'
import * as Phala from '../../sdk'


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

type PhalaFatContractQueryResult = {
  deployer: string;
  codeIndex: {
    WasmCode: string;
  }
  salt: string;
  clusterId: string;
  instantiateData: string;
}

const pruntimeURLAtom = atom('https://poc5.phala.network/tee-api-1')

export type LocalContractInfo = {
  contractId: string;
  metadata: ContractMetadata;
  createdAt: number;
}

export const contractsAtom = atomWithStorage<
  Record<string, LocalContractInfo>
>('owned-contracts', {})

export const currentContractIdAtom = atom('')

export const currentContractAtom = atom(get => {
  const contractId = get(currentContractIdAtom)
  const contracts = get(contractsAtom)
  return contracts[contractId]
})

export const phalaFatContractQueryAtom = atom(async get => {
  const api = get(rpcApiInstanceAtom)
  const info = get(currentContractAtom)
  if (!api || !info) {
    return null
  }
  const result = await new Promise(resolve => {
    api.query.phalaFatContracts.contracts(info.contractId, (result: { toHuman: () => unknown }) => resolve(result.toHuman()))
  })
  return result as PhalaFatContractQueryResult
})

export const contractInstanceAtom = atom<ContractPromise | null>(null)

export const derviedContractAtom = atom(async (get) => {
  const api = get(rpcApiInstanceAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  const contract = get(currentContractAtom)
  if (!api) {
    return
  }
  const contractPromise = new ContractPromise(
    await create({api, baseURL: pruntimeURL, contractId: contract.contractId}),
    contract.metadata,
    contract.contractId
  )
  return contractPromise
})

export const messagesAtom = atom(get => {
  const contract = get(currentContractAtom)
  if (!contract) {
    return []
  }
  return contract.metadata.V3.spec.messages || []
})

const pruntimeURL = 'https://poc5.phala.network/tee-api-1'

export const currentContractInstanceAtom = atom(async (get) => {
  const api = get(rpcApiInstanceAtom)
  const contract = get(currentContractAtom)
  if (!api || !contract) {
    return null
  }
  const contractId = contract?.contractId
  // https://poc5.phala.network/tee-api-1
  // const prpc = Phala.createPruntimeApi(pruntimeURL);
  // const worker = await getWorkerPubkey(api);
  // const connectedWorker = hex((await prpc.getInfo({})).publicKey);
  const newApi = await api.clone().isReady;
  const contractPromise = new ContractPromise(
    await Phala.create({api: newApi, baseURL: pruntimeURL, contractId}),
    contract.metadata,
    contractId
  );
  return contractPromise
});

async function sleep(t: number) {
  await new Promise(resolve => {
      setTimeout(resolve, t);
  });
}

async function checkUntil<T>(async_fn: () => Promise<T>, timeout: number) {
    const t0 = new Date().getTime();
    while (true) {
        if (await async_fn()) {
            return;
        }
        const t = new Date().getTime();
        if (t - t0 >= timeout) {
            throw new Error('timeout');
        }
        await sleep(100);
    }
}

async function blockBarrier(api: unknown, prpc: unknown, finalized=false, timeout=4*6000) {
  const head = await (finalized
      // @ts-ignore
      ? api.rpc.chain.getFinalizedHead()
      // @ts-ignore
      : api.rpc.chain.getHeader()
  );
  let chainHeight = head.number.toNumber();
  await checkUntil(
      // @ts-ignore
      async() => (await prpc.getInfo({})).blocknum > chainHeight,
      timeout,
  );
}


export const eventsAtom = atomWithReset<PolkadotEvent[]>([])

const dispatchEventAtom = atom(null, (get, set, events: EventRecord[]) => {
  const prev = get(eventsAtom)
  set(eventsAtom, [ ...R.reverse(events.map(i => i.event)), ...prev])
})

export const signAndSend = (target: SubmittableExtrinsic<ApiTypes>, address: string, signer: InjectedSigner) => {
  return new Promise(async (resolve, reject) => {
    // Ready -> Broadcast -> InBlock -> Finalized
    const unsub = await target.signAndSend(
      address, { signer }, (result) => {
        const humanized = result.toHuman()          
        if (result.status.isInBlock) {
          let error;
          for (const e of result.events) {
            const { event: { data, method, section } } = e;
            if (section === 'system' && method === 'ExtrinsicFailed') {
              error = data[0];
            }
          }
          // @ts-ignore
          unsub();
          if (error) {
            reject(error);
          } else {
            resolve({
              hash: result.status.asInBlock.toHuman(),
              // @ts-ignore
              events: result.toHuman().events,
            });
          }
        } else if (result.status.isInvalid) {
          // @ts-ignore
          unsub();
          reject('Invalid transaction');
        }
      }
    )
  })
}

export function useUploadCodeAndInstantiate() {
  const api = useAtomValue(rpcApiInstanceAtom)
  const dispatch = useUpdateAtom(dispatchEventAtom)
  const reset = useResetAtom(eventsAtom)
  const toast = useToast()
  const saveContract = useUpdateAtom(contractsAtom)

  useConnectApi()

  return useCallback(async (account: InjectedAccountWithMeta, contract:ContractMetadata, clusterId: string) => {
    if (!api) {
      throw new Error('API instance is not ready yet.')
    }
    reset()
    const { signer } = await web3FromSource(account.meta.source)
    const r1 = await signAndSend(api.tx.phalaFatContracts.uploadCodeToCluster(contract.source.wasm, clusterId), account.address, signer)
    // @ts-ignore
    dispatch(r1.events)
    const salt = '0x' + new Date().getTime()
    const initSelector = contract.V3.spec.constructors.filter(c => c.label === 'default' || c.label === 'new')[0].selector
    const r2 = await signAndSend(
      api.tx.phalaFatContracts.instantiateContract(
        { 'WasmCode': contract.source.hash }, initSelector, salt, clusterId
      ),
      account.address, signer
    )
    // @ts-ignore
    dispatch(r2.events)
    // @ts-ignore
    const instantiateEvent = R.find(R.pathEq(['event', 'method'], 'Instantiating'), r2.events)
    if (instantiateEvent && instantiateEvent.event.data.length > 2) {
      const contractId = instantiateEvent.event.data[0]
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId} }))
    }
    toast({
      title: 'Instantiate Requested.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }, [api, dispatch, reset, toast, saveContract])
}

export const currentMethodAtom = atom<ContractMetaMessage | null>(null)

export const useRunner = (): [boolean, (inputs: Record<string, unknown>) => Promise<void>] => {
  const methodSpec = useAtomValue(currentMethodAtom)
  const contractInstance = useAtomValue(currentContractInstanceAtom)
  const account = useAtomValue(lastSelectedAccountAtom)
  const [isLoading, setIsLoading] = useState(false)
  const fn = useCallback(async (inputs: Record<string, unknown>) => {
    setIsLoading(true)
    try {
      if (!contractInstance || !account || !methodSpec) {
        console.debug('contractInstance or account is null')
        return
      }
      console.log('methodSpec', methodSpec)

      const queryMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.query || {})
      ))
      const txMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.tx || {})
      ))
      // console.log('queryMethods', queryMethods)
      // console.log('txMethods', txMethods)

      if (!queryMethods[methodSpec.label] && !txMethods[methodSpec.label]) {
        console.debug('method not found', methodSpec.label)
        return
      }
      const args = R.map(
        i => inputs[i.label],
        methodSpec.args
      )
      console.log('args built: ', args)

      const { signer } = await web3FromSource(account.meta.source)

      // tx
      if (methodSpec.mutates) {
        const r1 = await signAndSend(
          contractInstance.tx[txMethods[methodSpec.label]]({}, ...args),
          account.address,
          signer
        )
        console.log(r1)
        const prpc = await Phala.createPruntimeApi(pruntimeURL)
        await blockBarrier(contractInstance.api, prpc)
      }
      // query
      else {
        // @ts-ignore
        const cert = await Phala.signCertificate({signer, account, api: contractInstance.api});
        // @ts-ignore
        const r2 = await contractInstance?.query[queryMethods[methodSpec.label]](cert, { value: 0, gasLimit: -1 }, ...args);
        console.log(r2)
        console.log(r2?.output?.toHuman())
        // if (methodSpec.label === 'attest') {
        //   console.log(
        //       'Easy attestation:',
        //       r2.result.isOk ? r2.output.toHuman() : r2.result.toHuman()
        //   );
        //   console.log(contractInstance.registry.createType('GistQuote', r2.output.asOk.data.toHex()).toHuman())
        // }
      }
      console.log('executed.')
    } finally {
      setIsLoading(false)
    }
  }, [contractInstance, account, methodSpec])
  return [isLoading, fn]
}