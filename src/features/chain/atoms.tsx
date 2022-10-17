import type { ChangeEvent } from 'react'
import type { ApiTypes } from '@polkadot/api-base/types/base'
import type { Vec, Bytes } from '@polkadot/types'
import type { AnyJson, Codec } from '@polkadot/types/types'
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
import { atomWithStorage, atomWithReset, useAtomValue, useUpdateAtom, useResetAtom, waitForAll } from 'jotai/utils'
import { atomWithQuery, queryClientAtom } from 'jotai/query'
import { Abi, ContractPromise } from '@polkadot/api-contract'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { stringify, stringToU8a } from '@polkadot/util'
import { keyring } from '@polkadot/ui-keyring'
import { xxhashAsHex } from '@polkadot/util-crypto'
import { khalaDev } from '@phala/typedefs'
import { web3FromSource } from '@polkadot/extension-dapp'
import { useToast } from '@chakra-ui/react'
import * as R from 'ramda'

import createLogger from '@/functions/createLogger'
import { lastSelectedAccountAtom } from '@/features/account/atoms'
import { contractSelectedInitSelectorAtom } from '@/features/instantiate/atoms'

import { create, createPruntimeApi, signCertificate, types as phalaSDKTypes } from '../../sdk'
import * as PhalaFatContractsQuery from './phala-fat-contracts-query'

//
// Types
//
type ApiConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

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

type PhalaFatContractQueryResult = {
  deployer: string;
  codeIndex: {
    WasmCode: string;
  }
  salt: string;
  clusterId: string;
  instantiateData: string;
}

export type LocalContractInfo = {
  contractId: string;
  metadata: ContractMetadata;
  savedAt?: number;
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

export type MethodRunResult = {
  contract: LocalContractInfo;
  methodSpec: ContractMetaMessage;
  succeed: boolean;
  args: Record<string, unknown>;
  output?: AnyJson;
  completedAt: number;
}

//
// Constants
//

const MAX_EVENTS = 75;

//
// Internal Functions
//

const debug = createLogger('chain', 'debug')

const apiTypes = { ...khalaDev, ...phalaSDKTypes }

export const createApiInstance = (endpointUrl: string): [WsProvider, ApiPromise] => {
  debug('create RPC connection to ', endpointUrl)
  const wsProvider = new WsProvider(endpointUrl)
  const api = new ApiPromise({ provider: wsProvider, types: apiTypes })
  return [wsProvider, api]
}

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

async function checkUntilEq<T>(async_fn: () => Promise<T>, expected: T, timeout: number, verbose=true) {
  const t0 = new Date().getTime();
  let lastActual = undefined;
  while (true) {
      const actual = await async_fn();
      if (actual == expected) {
          return;
      }
      if (actual != lastActual && verbose) {
          debug(`Waiting... (current = ${actual}, expected = ${expected})`)
          lastActual = actual;
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

export const signAndSend = (target: SubmittableExtrinsic<ApiTypes>, address: string, signer: InjectedSigner) => {
  return new Promise(async (resolve, reject) => {
    // Ready -> Broadcast -> InBlock -> Finalized
    const unsub = await target.signAndSend(
      address, { signer }, (result) => {
        const humanized = result.toHuman()          
        console.log('signAndSend result: ', result)
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

//
// Atoms
//

export const pruntimeURLAtom = atom('https://poc5.phala.network/tee-api-1')

export const rpcEndpointAtom = atom('')

export const rpcEndpointErrorAtom = atom('')

export const rpcApiInstanceAtom = atom<ApiPromise | null>(null)

export const rpcApiStatusAtom = atom<ApiConnectionStatus>('disconnected')

export const hasConnectedAtom = atom<boolean>(get => get(rpcApiStatusAtom) === 'connected')

export const systemEventsAtom = atom<{
  eventCount: number;
  events: KeyedEvent[];
}>({ eventCount: 0, events: [] })

//
// List of instantiated contracts from this browser, and they can access for all wallet accounts.
//
export const localContractsAtom = atomWithStorage<
  Record<string, LocalContractInfo>
>('owned-contracts', {})

export const availableContractsAtom = atomWithQuery(get => ({
  queryKey: ['phalaFatContracts.contracts'],
  queryFn: async () => {
    const api = get(rpcApiInstanceAtom)
    if (!api) {
      return []
    }

    const onChain = await PhalaFatContractsQuery.contracts(api)
    const onLocal = get(localContractsAtom)
    const onChainKeys = Object.keys(onChain)
  
    return R.pipe(
      R.filter((i: Pairs<LocalContractInfo>) => R.includes(i[0], onChainKeys)),
      R.sortBy((i) => R.propOr(0, 'savedAt', i[1])),
      lst => R.reverse<Pairs<LocalContractInfo>>(lst),
    )(Object.entries(onLocal))
  },
  refetchInterval: 1000 * 60 * 15, // every 15 minutes
  refetchIntervalInBackground: true,
}))

export const currentContractIdAtom = atom('')

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

export const currentContractAtom = atom(get => {
  const contractId = get(currentContractIdAtom)
  const contracts = get(localContractsAtom)
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
    (await create({api, baseURL: pruntimeURL, contractId: contract.contractId})).api,
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

export const currentMethodAtom = atom<ContractMetaMessage | null>(null)

export const eventsAtom = atomWithReset<PolkadotEvent[]>([])

const dispatchEventAtom = atom(null, (get, set, events: EventRecord[]) => {
  const prev = get(eventsAtom)
  set(eventsAtom, [ ...R.reverse(events.map(i => i.event)), ...prev ])
})

export const resultsAtom = atomWithReset<MethodRunResult[]>([])

const dispatchResultsAtom = atom(null, (get, set, result: MethodRunResult) => {
  const prev = get(resultsAtom)
  set(resultsAtom, [ result, ...prev ])
})

export const countsAtom = atom(get => {
  const events = get(eventsAtom)
  const results = get(resultsAtom)
  return {
    eventCount: events.length,
    resultCount: results.length,
  }
})

export const availableClustersAtom = atomWithQuery(get => ({
  queryKey: ['phalaFatContracts.clusters'],
  queryFn: async () => {
    await sleep(5000)
    const api = get(rpcApiInstanceAtom)
    if (!api) {
      return []
    }
    const result = await PhalaFatContractsQuery.clusters(api)
    return Object.entries(result)
  }
}))

//
// Hooks
//

export function useConnectApi() {
  const [endpointUrl, setEndpointUrl] = useAtom(rpcEndpointAtom)
  const setStatus = useUpdateAtom(rpcApiStatusAtom)
  const setApiInstance = useUpdateAtom(rpcApiInstanceAtom)
  const setError = useUpdateAtom(rpcEndpointErrorAtom)
  useEffect(() => {
    setError('')
    if (!endpointUrl) {
      debug('setStatus -> disconnected')
      setStatus('disconnected')
      setApiInstance(null)
    } else {
      debug('setStatus -> connecting')
      setStatus('connecting')

      const fn = async () => {
        const [ws, api] = createApiInstance(endpointUrl)

        ws.on('error', (error) => {
          const isFirefox = window.navigator.userAgent.indexOf('Firefox') !== -1
          setApiInstance(null)
          setEndpointUrl('')
          debug('setStatus -> error')
          if (isFirefox) {
            setError('RPC Endpoint is unreachable. If you are using Firefox, please switch to Chrome and try again.')
          } else {
            setError('RPC Endpoint is unreachable.')
          }
        })

        api.on('connected', async () => {
          await api.isReady
          setStatus('connected')
          debug('setStatus -> connected')
        })

        api.on('disconnected', () => {
          debug('setStatus -> disconnected')
          setStatus((prev) => prev === 'error' ? prev : 'disconnected')
          setEndpointUrl('')
        })
  
        api.on('ready', () => debug('API ready'))
  
        const onError = (err: unknown) => {
          debug('api error', err)
          setStatus('error')
          setError(`RPC Error`)
          setApiInstance(null)
          setEndpointUrl('')
          api.off('error', onError)
          try {
            api.disconnect()
            ws.disconnect()
          } catch (err1) {
            debug('hey yo', err1)
          }
        }
        api.on('error', onError)

        setTimeout(() => {
          setStatus(prev => {
            if (prev !== 'connected') {
              setApiInstance(null)
              setEndpointUrl('')
              debug('setStatus -> error')
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
        debug('error', err)
      }
    }
  }, [endpointUrl, setEndpointUrl, setStatus, setApiInstance, setError])
}

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

export function useUploadCodeAndInstantiate() {
  const api = useAtomValue(rpcApiInstanceAtom)
  const dispatch = useUpdateAtom(dispatchEventAtom)
  const reset = useResetAtom(eventsAtom)
  const toast = useToast()
  const saveContract = useUpdateAtom(localContractsAtom)
  const chooseInitSelector = useAtomValue(contractSelectedInitSelectorAtom)

  useConnectApi()

  return useCallback(async (account: InjectedAccountWithMeta, contract:ContractMetadata, clusterId: string) => {
    if (!api) {
      throw new Error('API instance is not ready yet.')
    }
    console.group('Instantiate Contract:', clusterId)
    try {
      const { signer } = await web3FromSource(account.meta.source)

      // Clear the Event Panel.
      reset()
  
      const salt = '0x' + new Date().getTime()

      if (contract.V3.spec.constructors.length === 0) {
        throw new Error('No constructor found.')
      }
      const defaultInitSelector = R.pipe(
        R.filter((c: ContractMetaConstructor) => c.label === 'default' || c.label === 'new'),
        R.sortBy((c: ContractMetaConstructor) => c.args.length),
        i => R.head<ContractMetaConstructor>(i),
        (i) => i ? i.selector : undefined,
      )(contract.V3.spec.constructors)

      const initSelector = chooseInitSelector || defaultInitSelector
      console.log('user choose initSelector: ', chooseInitSelector)
      console.log('default initSelector: ', defaultInitSelector)
      if (!initSelector) {
        throw new Error('No valid initSelector specified.')
      }
  
      // Upload & instantiate contract
      console.info('Final initSelector: ', initSelector, 'clusterId: ', clusterId)
      const result = await signAndSend(
        api.tx.utility.batchAll([
          api.tx.phalaFatContracts.clusterUploadResource(clusterId, 'InkCode',contract.source.wasm),
          api.tx.phalaFatContracts.instantiateContract(
            { 'WasmCode': contract.source.hash }, initSelector, salt, clusterId
          ),
        ]),
        account.address,
        signer
      )
      // @ts-ignore
      dispatch(result.events)
      console.log('Uploaded. Wait for the contract to be instantiated...', result)
  
      // @ts-ignore
      const instantiateEvent = R.find(R.pathEq(['event', 'method'], 'Instantiating'), result.events)
      if (instantiateEvent && instantiateEvent.event.data && instantiateEvent.event.data.contract) {
        const contractId = instantiateEvent.event.data.contract
        const metadata = R.dissocPath(['source', 'wasm'], contract)
  
        // Check contracts in cluster or not.
        console.log('Pooling: Check contracts in cluster (30 secs timeout)')
        try {
          await checkUntilEq(
            async () => {
              const contractIds = await PhalaFatContractsQuery.clusterContracts(api, clusterId)
              return contractIds.filter(id => id === contractId).length
            },
            1,
            1000 * 30 // 30 secs
          )
        } catch (err) {
          throw new Error('Failed to check contract in cluster: may be initialized failed in cluster')
        }

        console.log('Pooling: ensure contract exists in registry (30 secs timeout)')
        await checkUntil(
          // @ts-ignore
          async () => (await api.query.phalaRegistry.contractKeys(contractId)).isSome,
          4 * 6000
        )
  
        // Save contract metadata to local storage
        console.log('Save contract metadata to local storage.')
        saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} }))
  
        toast({
          title: 'Instantiate Requested.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
        return contractId
      } else {
        throw new Error('Contract instantiation failed.')
      }
    } catch (err) {
      toast({
        title: `${err}`,
        status: 'error',
        isClosable: true,
      })
    } finally {
      console.groupEnd()
    }
  }, [api, dispatch, reset, toast, saveContract, chooseInitSelector])
}

export function useRunner(): [boolean, (inputs: Record<string, unknown>, overrideMethodSpec?: ContractMetaMessage) => Promise<void>] {
  const [api, pruntimeURL, selectedMethodSpec, contract, account, queryClient] = useAtomValue(waitForAll([
    rpcApiInstanceAtom,
    pruntimeURLAtom,
    currentMethodAtom,
    currentContractAtom,
    lastSelectedAccountAtom,
    queryClientAtom,
  ]))
  const appendResult = useUpdateAtom(dispatchResultsAtom)
  const dispatch = useUpdateAtom(dispatchEventAtom)
  const [isLoading, setIsLoading] = useState(false)

  const fn = useCallback(async (inputs: Record<string, unknown>, overrideMethodSpec?: ContractMetaMessage) => {
    setIsLoading(true)
    const methodSpec = overrideMethodSpec || selectedMethodSpec
    try {
      if (!api || !account || !methodSpec) {
        debug('contractInstance or account is null')
        return
      }
      console.log('contract', contract)
      const apiCopy = await api.clone().isReady
      const contractInstance = new ContractPromise(
        (await create({api: apiCopy, baseURL: pruntimeURL, contractId: contract.contractId})).api,
        contract.metadata,
        contract.contractId
      )
      debug('methodSpec', methodSpec)

      const queryMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.query || {})
      ))
      const txMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.tx || {})
      ))
      // debug('queryMethods', queryMethods)
      // debug('txMethods', txMethods)

      if (!queryMethods[methodSpec.label] && !txMethods[methodSpec.label]) {
        debug('method not found', methodSpec.label)
        return
      }
      const args = R.map(
        i => inputs[i.label],
        methodSpec.args
      )
      debug('args built: ', args)

      // tx
      if (methodSpec.mutates) {
        const { signer } = await web3FromSource(account.meta.source)
        const r1 = await signAndSend(
          contractInstance.tx[txMethods[methodSpec.label]]({}, ...args),
          account.address,
          signer
        )
        // @ts-ignore
        dispatch(r1.events)
        debug('result: ', r1)
        const prpc = await createPruntimeApi(pruntimeURL)
        await blockBarrier(contractInstance.api, prpc)
      }
      // query
      else {
        const cert = await queryClient.fetchQuery(['queryContractCert', account.address], async () => {
          const { signer } = await web3FromSource(account.meta.source)
          // @ts-ignore
          return await signCertificate({signer, account, api: contractInstance.api as ApiPromise})
        }, {
          staleTime: 1000 * 60 * 15, // 15 minutes
        })
        const queryResult = await contractInstance.query[queryMethods[methodSpec.label]](
          // @FIXME this is a hack to make the ts compiler happy.
          cert as unknown as string,
          // querySignCache as unknown as string,
          { value: 0, gasLimit: -1 },
          ...args
        )
        debug('query result: ', queryResult)
        // @TODO Error handling
        if (queryResult.result.isOk) {
          appendResult({
            contract,
            methodSpec,
            succeed: true,
            args: inputs,
            output: queryResult.output?.toHuman(),
            completedAt: Date.now(),
          })
        } else {
          appendResult({
            contract,
            methodSpec,
            succeed: false,
            args: inputs,
            output: queryResult.result.toHuman(),
            completedAt: Date.now(),
          })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [api, pruntimeURL, contract, account, selectedMethodSpec, appendResult, dispatch, queryClient])
  return [isLoading, fn]
}

export function useLocalContractsImport() {
  const saveContract = useUpdateAtom(localContractsAtom)
  // TODO validation
  return useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    if (evt.target && evt.target.files && evt.target.files.length) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        try {
          const contract = JSON.parse(reader.result as string)
          console.log('load', contract)
          if (!contract || !contract.source || !contract.source.hash) {
            // set(contractParserErrorAtom, "Your contract file is invalid.")
            console.log('import error: Your contract file is invalid')
            return
          }
          if (!contract.V3) {
            console.log('import error: Your contract metadata version is too low, Please upgrade your cargo-contract with `cargo install cargo-contract --force`.')
            // set(contractParserErrorAtom, "Your contract metadata version is too low, Please upgrade your cargo-contract with `cargo install cargo-contract --force`.")
            return
          }
          if (!contract.phat || !contract.phat.contractId) {
            console.log('import error: For now only support metadata that export from contract UI.')
            // set(contractParserErrorAtom, "Your contract metadata version is too low, Please upgrade your cargo-contract with `cargo install cargo-contract --force`.")
            return
          }
          const { phat, wasm, ...metadata } = contract
          saveContract(exists => ({ ...exists, [phat.contractId]: {metadata, contractId: phat.contractId, savedAt: Date.now()} }))
        } catch (e) {
          console.error(e)
          // set(contractParserErrorAtom, `Your contract file is invalid: ${e}`)
        } finally {
          evt.target.value = ''
        }
      })
      reader.readAsText(evt.target.files[0], 'utf-8')
    }
    // const file = inputEl.target.files[0]
    // saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} }))
  }, [saveContract])
}
