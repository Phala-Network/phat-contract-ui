import type { FC } from 'react'
import type { ContractExecuteResult } from '@/features/phat-contract/atoms'

import React, { Suspense, useMemo, useState } from 'react'
import { Link } from "@tanstack/react-location"
import tw from 'twin.macro'
import { atom, useAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import {
  TiTick,
  TiInfoOutline,
  TiTimes,
  TiArrowRepeat,
  TiMessageTyping,
  TiCogOutline,
  TiCloudStorageOutline,
  TiMessage,
} from 'react-icons/ti'
import { IoIosRefresh } from 'react-icons/io'
import {
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  List,
  ListItem,
  Flex,
  Text,
  Tooltip,
  Spacer,
  Center,
  Box,
} from '@chakra-ui/react'
import * as R from 'ramda'

import { eventsAtom } from '@/features/parachain/atoms'
import { resultsAtom, pinkLoggerResultAtom } from '@/features/phat-contract/atoms'
import { formatNumber } from '@polkadot/util'
import Identicon from '@polkadot/react-identicon'
import { AccountId, EventMetadataLatest } from '@polkadot/types/interfaces'
import { KeyringItemType, KeyringJson$Meta } from '@polkadot/ui-keyring/types'
import keyring from '@polkadot/ui-keyring'
import { keyedEventsAtom, recentBlocksAtom } from '@/features/chain-info/atoms'
import { Text as TextType } from '@polkadot/types'
import { endpointAtom } from '@/atoms/endpointsAtom'
import ScrollContainer from './ScrollContainer'
import { pinkLoggerAtom, currentContractIdAtom } from '@/features/phat-contract/atoms'


export enum TabIndex {
  Events,
  Result,
  Log,
  RecentBlocks,
  RecentEvents,
}

const toggleEventListAtom = atom<boolean>(true)
const currentTabAtom = atom<number>(0)

const eventCountsAtom = atom(get => get(eventsAtom).length)
const resultCountsAtom = atom(get => get(resultsAtom).length)
const logCountsAtom = atom(get => get(pinkLoggerResultAtom).length)
const recentBlockCountsAtom = atom(get => get(recentBlocksAtom).length)
const keyedEventsCountsAtom = atom(get => get(keyedEventsAtom).length)

export const dispatchOpenTabAtom = atom(null, (_, set, tabIndex: TabIndex) => {
  set(toggleEventListAtom, true)
  set(currentTabAtom, tabIndex)
})

function useRefreshCurrentContractLog() {
  const pinkLogger = useAtomValue(pinkLoggerAtom)
  const currentContractId = useAtomValue(currentContractIdAtom)
  const setLogs = useUpdateAtom(pinkLoggerResultAtom)
  return useMemo(() => {
    if (!currentContractId || !pinkLogger) {
      return null
    }
    return async function() {
      const { records } = await pinkLogger.getLog(currentContractId)
      setLogs(R.reverse(records))
    }
  }, [pinkLogger, currentContractId, setLogs])
}

function AdditionalButtonGroup() {
  const refresh = useRefreshCurrentContractLog()
  const currentTab = useAtomValue(currentTabAtom)
  const [isLoading, setIsLoading] = useState(false)
  if (!refresh || currentTab !== 2) {
    return null
  }
  return (
    <Tooltip label="Reload logs">
      <button
        tw="p-0.5 rounded bg-gray-900 hover:bg-phalaDark-500 hover:text-black"
        onClick={async () => {
          setIsLoading(true)
          await refresh()
          setIsLoading(false)
        }}
      >
        <IoIosRefresh css={[tw`text-xs`, isLoading ? tw`animate-spin` : null]} />
      </button>
    </Tooltip>
  )
}


const CloseButton = () => {
  const setShowEventList = useUpdateAtom(toggleEventListAtom)
  return (
    <div tw="absolute top-2 right-0 flex flex-row gap-2 items-center">
      <Suspense fallback={<div />}>
        <AdditionalButtonGroup />
      </Suspense>
      <button
        tw="p-0.5 rounded bg-gray-900 hover:bg-phalaDark-500 hover:text-black"
        onClick={() => setShowEventList(false)}
      >
        <TiTimes tw="text-base" />
      </button>
    </div>
  )
}

const RecentHeadersCounter = ({ onClick }: { onClick: () => void }) => {
  const recentBlockCounts = useAtomValue(recentBlockCountsAtom)

  return (
    <CounterButton
      onClick={onClick}
    >
      <TiCloudStorageOutline tw="text-base" />
      <span tw="text-xs font-mono">{recentBlockCounts}</span>
    </CounterButton>
  )
}

const CounterButton = tw.button`
  flex gap-0.5 px-0.5 justify-center items-center transition-colors text-gray-400 hover:bg-phalaDark-500 hover:text-black rounded-sm
`

const Counters = () => {
  const setShowEventList = useUpdateAtom(toggleEventListAtom)
  const setCurrentTab = useUpdateAtom(currentTabAtom)
  const eventCounts = useAtomValue(eventCountsAtom)
  const resultCounts = useAtomValue(resultCountsAtom)
  const logCounts = useAtomValue(logCountsAtom)
  const keyedEventsCounts = useAtomValue(keyedEventsCountsAtom)
  return (
    <div tw="flex flex-row gap-2.5">
      <CounterButton
        onClick={() => {
          setShowEventList(true)
          setCurrentTab(0)
        }}
      >
        <TiArrowRepeat tw="text-base" />
        <span tw="text-xs font-mono">{eventCounts}</span>
      </CounterButton>
      <CounterButton
        onClick={() => {
          setShowEventList(true)
          setCurrentTab(1)
        }}
      >
        <TiMessageTyping tw="text-base" />
        <span tw="text-xs font-mono">{resultCounts}</span>
      </CounterButton>
      <CounterButton
        onClick={() => {
          setShowEventList(true)
          setCurrentTab(2)
        }}
      >
        <TiCogOutline tw="text-base" />
        <span tw="text-xs font-mono">{logCounts}</span>
      </CounterButton>
      <Suspense>
        <RecentHeadersCounter onClick={() => {
          setShowEventList(true)
          setCurrentTab(3)
        }} />
      </Suspense>
      <CounterButton
        onClick={() => {
          setShowEventList(true)
          setCurrentTab(4)
        }}
      >
        <TiMessage tw="text-base" />
        <span tw="text-xs font-mono">{keyedEventsCounts}</span>
      </CounterButton>
    </div>
  )
}

const QueryResultHistoryItem: FC<ContractExecuteResult> = (result) => {
  const completedAt = new Date(result.completedAt)
  const completedAtString = completedAt.toLocaleString()
  return (
    <div>
      <div tw="flex flex-row gap-3">
        <div tw="rounded-full w-8 h-8 bg-gray-900 flex justify-center items-center border border-solid border-gray-800">
          {result.succeed ? <TiTick tw="text-xl text-phala-500" /> : <TiTimes tw="text-xl text-red-500" />}
        </div>
        <article tw="flex-grow bg-gray-900 border border-solid border-gray-700 rounded-sm px-4 pt-2 pb-3">
          <header tw="flex justify-between pb-2 mb-2 border-b border-solid border-gray-700">
            <Link to={`/contracts/view/${result.contract.contractId}`}>
              <h4 tw="text-[13px] font-mono px-2 py-1 bg-black rounded-lg inline-block">
                {result.contract.metadata.contract.name}
                .
                {result.methodSpec.label}
              </h4>
              <div tw="text-xs font-mono px-2 my-1 text-gray-400">{result.contract.contractId}</div>
            </Link>
            <time tw="text-sm text-gray-400 mt-1">{completedAtString}</time>
          </header>
          <pre tw="text-[13px] font-mono">
            {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
          </pre>
        </article>
      </div>
    </div>
  )
}

const EventPanel = () => {
  const events = useAtomValue(eventsAtom)
  // const reset = useResetAtom(eventsAtom)
  return (
    <div tw="flex flex-col gap-4">
      {!events.length && (
        <div tw="text-gray-600 text-sm flex items-center">
          <TiInfoOutline tw="mr-1 text-lg" />
          Empty.
        </div>
      )}
      {events.map((event, index) => {
        const pairs = R.toPairs(event.data)
        return (
          <article key={index} tw="flex-grow bg-gray-900 border border-solid border-gray-700 rounded-sm px-4 pt-2 pb-3">
            <div>
              <Badge borderRadius='full' px='2' colorScheme='phala' mr="2">{event.section}</Badge>
              <Badge borderRadius='full' px='2' colorScheme='phalaDark'>{event.method}</Badge>
            </div>
            {(pairs.length > 0) && (
              <dl tw="mt-2 px-1 text-xs font-mono">
                {pairs.map(([key, value]) => (
                  <div tw="my-2 flex flex-row" key={key}>
                    <dt tw="mr-2">{key}:</dt>
                    <dd>{(typeof value === 'string') ? value : JSON.stringify(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        )
      })}
    </div>
  )
}

function ResultPanel() {
  const queryResults = useAtomValue(resultsAtom)
  return (
    <div tw="flex flex-col gap-4">
      {!queryResults.length && (
        <div tw="text-gray-600 text-sm flex items-center">
          <TiInfoOutline tw="mr-1 text-lg" />
          Empty.
        </div>
      )}
      {queryResults.map((result, index) => (
        <div key={index}>
          <QueryResultHistoryItem {...result} />
        </div>
      ))}
    </div>
  )
}

const Logs = () => {
  const logs = useAtomValue(pinkLoggerResultAtom)
  return (
    <div tw="flex flex-col gap-2 my-4">
      {logs.map((log, i) => {
        if (log.type === 'Log') {
          return (
            <div key={i} tw="font-mono text-sm flex flex-row gap-1">
              <div tw="text-gray-500 flex flex-row gap-0.5">
                <span>[#{log.blockNumber}]</span>
                <span>[{(new Date(log.timestamp)).toISOString()}]</span>
              </div>
              <pre>
                {log.message}
              </pre>
            </div>
          )
        }
        if (log.type !== 'MessageOutput') {
          return <div key={i} tw="font-mono text-sm">{JSON.stringify(log)}</div>
        }
        return (
          <div key={i} tw="font-mono text-sm">
            <span tw="mr-1">[#{log.blockNumber}]</span>
            <span tw="mr-1">MessageOutput</span>
            {log.decoded ? log.decoded : log.output}
          </div>
        )
      })}
    </div>
  )
}

const getAddressMeta = (address: string, type: KeyringItemType | null = null): KeyringJson$Meta | undefined => {
  try {
    const pair = keyring.getAddress(address, type);

    if (pair && pair.meta) {
      return pair.meta
    }
  } catch (error) {
    // we could pass invalid addresses, so it may throw
  }
}

const toShortAddress = (_address: string): string => {
  const address = (_address || '').toString();

  return (address.length > 13)
    ? `${address.slice(0, 6)}…${address.slice(-6)}`
    : address;
}

// isName, name
const getAddressName = (address: string): [boolean, string] => {
  const meta = getAddressMeta(address);

  return meta && meta.name
    ? [false, meta.name.toUpperCase()]
    : [true, toShortAddress(address)];
}

interface AccountNameProps {
  value?: AccountId;
}

const AccountName = ({ value }: AccountNameProps) => {
  if (!value) {
    return null
  }

  const accountId = value.toString()
  const [isAddressExtracted, displayName] = getAddressName(accountId)
  const tip = `Name is ${isAddressExtracted ? 'Online' : 'Local'}: ${displayName}`

  return (
    <Tooltip label={tip}>
      <Text noOfLines={1} fontSize="13">{displayName}</Text>
    </Tooltip>
  )
}

const RecentBlocksPanel = () => {
  const recentBlocks = useAtomValue(recentBlocksAtom)
  const endpoint = useAtomValue(endpointAtom)
  return (
    <List tw="font-mono">
      {
        recentBlocks.map(header => {
          const hashHex = header.hash.toHex()
          const author = header.author

          const blockDetailHref = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(endpoint)}#/explorer/query/${hashHex}`

          return (
            <ListItem key={header.number.toString()}>
              <Flex my="1">
                <Text as="a" href={blockDetailHref} target="_blank" tw="hover:opacity-80" marginRight={4} cursor="pointer" fontSize="14">
                  {formatNumber(header.number)}
                </Text>
                <Text as="a" href={blockDetailHref} target="_blank" tw="hover:opacity-80" flexGrow={1} noOfLines={1} maxWidth="100%" marginRight={2} fontSize="14">
                  {hashHex}
                </Text>
                <span tw="inline-flex flex-row gap-1 items-center">
                  <Identicon
                    size={16}
                    value={author}
                  />
                  <AccountName value={author as unknown as AccountId} />
                </span>
              </Flex>
            </ListItem>
          )
        })
      }
    </List>
  )
}

// @example ['a', 'b', '(ab)12.3#<weight>456</weight>\[`123`\]', '', '', '789']
//       => ['a b (ab)12.3', '123', '']
export const formatMetaDocs = R.pipe(
  // @example, ['a', 'b', '(ab)12.3#<weight>456</weight>\[`123`\]', '', '', '789']
  //       => ['a', 'b', '(ab)12.3#<weight>456</weight>\[`123`\]']
  (strings: string[]): string[] => {
    // find the first empty string index
    const firstEmptyIndex = R.findIndex(R.isEmpty, strings)
    // slice from the zeroth element to the previous element where the first is empty
    return R.slice(
      0,
      firstEmptyIndex === -1 ? Infinity : firstEmptyIndex,
      strings
    )
  },
  // join a string array to a long string
  // @example, ['a', 'b', '(ab)12.3#<weight>456</weight>\[`123`\]']
  //       => 'a b (ab)12.3#<weight>456</weight>\[`123`\]'
  R.join(' '),
  // remove HTML tag, leave pure text
  // @example 'a b (ab)12.3#<weight>456</weight>\[`123`\]'
  //       => 'a b (ab)12.3\[`123`\]'
  R.replace(/#(<weight>| <weight>).*<\/weight>/, ''),
  // remove special char
  // @example 'a b (ab)12.3\[`123`\]'
  //       => 'a b (ab)12.3[123]'
  R.replace(/[\\\`]/g, ''),
  // @example 'a b (ab)12.3[123]'
  //       => ['a b (ab)12.3', '123', '']
  R.split(/[\[\]]/g),
)

const formatMeta = (meta?: EventMetadataLatest): [React.ReactNode, React.ReactNode] | null => {
  if (!meta || !meta.docs.length) {
    return null;
  }

  // Vec<Text> => [TextType, TextType]
  // TextType is an object like String that has a .toString method that can convert to string
  const originDocs = meta.docs.toArray()
  // convert every Text to string
  // @example, [Text, Text] => ['a', 'b', '(ab)12.3#<weight>456</weight>\[`123`\]', '', '', '789']
  const docs = R.map<TextType, string>(doc => R.trim(doc.toString()), originDocs)
  const parts = formatMetaDocs(docs)

  const headerSubInfo = R.pipe(
    // @example ['a b (ab)12.3', '123', '']
    //       => 'a b (ab)12.3'
    R.head<string>,
    R.defaultTo(''),
    // @example ['a b (ab)12.3', '123', ''] => ['a b ', 'ab)12.3']
    R.split(/[.(]/),
    // @example ['a b ', 'ab)12.3'] => 'a b '
    R.head<string>,
    R.defaultTo(''),
  )(parts)

  return [
    headerSubInfo,
    <>
      {parts.map((part, index) => (
        index % 2
          ? <em key={index}>[{part}]</em>
          : <span key={index}>{part}</span>
      ))}
      &nbsp;
    </>
  ];
}

const RecentEventsPanel = () => {
  const keyedEvents = useAtomValue(keyedEventsAtom)
  const endpoint = useAtomValue(endpointAtom)

  return (
    <List>
      {
        keyedEvents.map(event => {
          const { blockNumber, blockHash = '', indexes, key, record } = event
          const eventName = `${record.event.section}.${record.event.method}`
          const headerSubInfo = formatMeta(record.event.meta)
          const displayIndexesLength = `${formatNumber(indexes.length)}x`
          const displayBlockNumber = `${formatNumber(blockNumber)}-${indexes[0]}`

          const blockNumberHref = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(endpoint)}#/explorer/query/${blockHash}`

          return (
            <ListItem py={1} key={key}>
              <Flex>
                <Box as="span" flex='1' textAlign='left'>
                  <Text noOfLines={1} fontSize="sm">{eventName}</Text>
                  { headerSubInfo ? (
                    <Tooltip label={headerSubInfo[0]}>
                      <Text noOfLines={1} fontSize="xs" opacity="0.6">{headerSubInfo[0]}</Text>
                    </Tooltip>
                  ) : null}
                </Box>
                <Spacer />
                <Center>
                  <Text as="a" href={blockNumberHref} target="_blank" tw="font-mono hover:opacity-80" cursor="pointer" fontSize="sm" noOfLines={1}>
                    {indexes.length !== 1 ? <span>({displayIndexesLength})&nbsp;</span> : null}
                    {displayBlockNumber}
                  </Text>
                </Center>
              </Flex>
            </ListItem>
          )
        })
      }
    </List>
  )
}

const TabLabel = tw.span`text-[13px] uppercase`

export default function StatusBar() {
  const showEventList = useAtomValue(toggleEventListAtom)
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom)

  return (
    <footer css={[tw`flex-shrink bg-black max-w-full px-4 border-t-[0.5px] border-solid border-gray-700`]}>
      <div css={[showEventList ? tw`h-0 hidden` : tw`h-8`]}>
        <div tw="mx-auto h-full w-full max-w-7xl transition-all flex items-center">
          <Suspense>
            <Counters />
          </Suspense>
        </div>
      </div>
      <div
        css={[
          tw`flex flex-row bg-black mx-auto w-full max-w-7xl transition-all`,
          showEventList ? tw`h-auto` : tw`h-0 overflow-hidden`,
        ]}
      >
        <Tabs tw="w-full" colorScheme="phalaDark" index={currentTab} onChange={i => setCurrentTab(i)}>
          <TabList tw="relative">
            <Tab>
              <TiArrowRepeat css={[tw`text-gray-400 text-base mr-1`, currentTab === 0 ? tw`text-phalaDark-300` : '']} />
              <TabLabel>Events</TabLabel>
            </Tab>
            <Tab>
              <TiMessageTyping css={[tw`text-gray-400 text-base mr-1`, currentTab === 1 ? tw`text-phalaDark-300` : '']} />
              <TabLabel>Result</TabLabel>
            </Tab>
            <Tab>
              <TiCogOutline css={[tw`text-gray-400 text-base mr-1`, currentTab === 2 ? tw`text-phalaDark-300` : '']} />
              <TabLabel>Log</TabLabel>
            </Tab>
            <Tab>
              <TiCloudStorageOutline css={[tw`text-gray-400 text-base mr-1`, currentTab === 3 ? tw`text-phalaDark-300` : '']} />
              <TabLabel>Recent blocks</TabLabel>
            </Tab>
            <Tab>
              <TiMessage css={[tw`text-gray-400 text-base mr-1`, currentTab === 4 ? tw`text-phalaDark-300` : '']}/>
              <TabLabel>Recent events</TabLabel>
            </Tab>
            <CloseButton />
          </TabList>
          <TabPanels>
            <TabPanel px="0">
              <ScrollContainer tw="overflow-y-scroll h-[26vh] px-6">
                <EventPanel />
              </ScrollContainer>
            </TabPanel>
            <TabPanel px="0">
              <ScrollContainer tw="overflow-y-scroll h-[26vh] px-6">
                <ResultPanel />
              </ScrollContainer>
            </TabPanel>
            <TabPanel px="0">
              <ScrollContainer tw="overflow-y-scroll h-[26vh] px-6">
                <Logs />
              </ScrollContainer>
            </TabPanel>
            <TabPanel px="0">
              <ScrollContainer tw="overflow-y-scroll h-[26vh] px-6">
                <Suspense>
                  <RecentBlocksPanel />
                </Suspense>
              </ScrollContainer>
            </TabPanel>
            <TabPanel px="0">
              <ScrollContainer tw="overflow-y-scroll h-[26vh] px-6">
                <Suspense>
                  <RecentEventsPanel />
                </Suspense>
              </ScrollContainer>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </footer>
  )
}
