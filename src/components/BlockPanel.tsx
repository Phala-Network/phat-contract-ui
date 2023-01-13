/**
 * @file 块相关的信息面板，https://www.notion.so/phalanetwork/a475b91c6a12455a8f7635dfc56bd2d3
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Center, Flex, Text, List, ListItem, Spacer, AccordionItem, Accordion, AccordionButton, AccordionIcon, Box, Tooltip, AccordionPanel } from '@chakra-ui/react'
import { useAtomValue } from 'jotai';
import tw from 'twin.macro'
import { apiPromiseAtom } from '@/features/parachain/atoms';
import { AccountId, AccountIndex, Address, BlockNumber, Event, EventMetadataLatest, EventRecord, Moment } from '@polkadot/types/interfaces';
import { BN, bnMin, BN_MAX_INTEGER, BN_THOUSAND, BN_TWO, extractTime, formatNumber, stringify, stringToU8a } from '@polkadot/util';
import { Time } from '@polkadot/util/types';
import { Bytes, Vec } from '@polkadot/types';
import { Codec } from '@polkadot/types-codec/types';
import type { HeaderExtended } from '@polkadot/api-derive/types';
import { ApiPromise } from '@polkadot/api';
import { xxhashAsHex } from '@polkadot/util-crypto';
import { UnsubscribePromise } from '@polkadot/api/types';
import Identicon from '@polkadot/react-identicon'
import { keyring } from '@polkadot/ui-keyring';
import { KeyringItemType, KeyringJson, KeyringJson$Meta } from '@polkadot/ui-keyring/types';
import { Abi } from '@polkadot/api-contract';
import { DecodedEvent } from '@polkadot/api-contract/types';

const LOCAL_UPDATE_TIME = 100;

// 格式化时间，time 是秒的单位
const formatTime = (time: number, type: 's' | 'min' | 'hr' = 's') => {
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

// 获取最后的块从创建到现在的时间，返回具有格式的字符串
const getLastBlockFromCreateToNowTime = (localNow: number, lastBlockTime?: number): string => {
  if (!lastBlockTime) {
    return '0s'
  }

  // 单位 秒
  const fromCreateToNowTime = Math.max(Math.abs(localNow - lastBlockTime), 0) / 1000;

  return formatTime(fromCreateToNowTime)
}

// 本地最新时间，循环更新
const useLocalNow = (): number => {
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

// 远程最后区块的创建时间
const useLastBlockTime = (): number | undefined => {
  const api = useAtomValue(apiPromiseAtom)
  const [lastBlockTime, setLastBlockTime] = useState<Moment>()

  useEffect(() => {
    // subscribe api.query.timestamp?.now
    const subscriber = api.query.timestamp?.now((moment: Moment) => {
      setLastBlockTime(moment)
    })

    return () => {
      subscriber.then(unsubscribe => (unsubscribe as unknown as Function)())
    }
  })

  return lastBlockTime?.toNumber()
}

// 读取块的目标创建时间
const THRESHOLD = BN_THOUSAND.div(BN_TWO);
const DEFAULT_TIME = new BN(6_000);
const A_DAY = new BN(24 * 60 * 60 * 1000);
const calcTargetTime = (api: any) => {
  // 取最小的 big number
  return bnMin(
    // 一天的时间
    A_DAY,
    (
    // Babe, e.g. Relay chains (Substrate defaults)
    api.consts.babe?.expectedBlockTime ||
    // POW, eg. Kulupu
    api.consts.difficulty?.targetBlockTime ||
    // Subspace
    api.consts.subspace?.expectedBlockTime || (
      // Check against threshold to determine value validity
      api.consts.timestamp?.minimumPeriod.gte(THRESHOLD)
        // Default minimum period config
        ? api.consts.timestamp.minimumPeriod.mul(BN_TWO)
        : api.query.parachainSystem
          // default guess for a parachain
          ? DEFAULT_TIME.mul(BN_TWO)
          // default guess for others
          : DEFAULT_TIME
    )
  ))
}

// 将目标时间转化成一个有结构的数组 [timestamp, string, Time]
const calcTargetTimeInfo = (blockTime: BN): [number, string, Time] => {
  // in the case of excessively large locks, limit to the max JS integer value
  const value = bnMin(BN_MAX_INTEGER, blockTime).toNumber();

  // time calculations are using the absolute value (< 0 detection only on strings)
  // 转化成时间对象
  const time = extractTime(Math.abs(value));

  const { days, hours, minutes, seconds } = time;

  return [
    // 一个块的目标创建时间
    blockTime.toNumber(),
    // 最终格式是 1day 1hr 1min
    `${value < 0 ? '+' : ''}${[
      days
        ? (days > 1)
          ? `${days} days`
          : '1 day'
        : null,
      hours
        ? (hours > 1)
          ? `${hours} hrs`
          : '1 hr'
        : null,
      minutes
        ? (minutes > 1)
          ? `${minutes} mins`
          : '1 min'
        : null,
      seconds
        ? (seconds > 1)
          ? `${seconds} s`
          : '1 s'
        : null
    ]
      .filter((s): s is string => !!s)
      .slice(0, 2)
      .join(' ')}`,
    // 时间对象也给返回了
    time
  ]
}

const splitSingle = (value: string[], sep: string): string[] => {
  return value.reduce((result: string[], value: string): string[] => {
    return value.split(sep).reduce((result: string[], value: string) => result.concat(value), result);
  }, []);
}

const splitParts = (value: string): string[] => {
  return ['[', ']'].reduce((result: string[], sep) => splitSingle(result, sep), [value]);
}

const formatMeta = (meta?: EventMetadataLatest): [React.ReactNode, React.ReactNode] | null => {
  if (!meta || !meta.docs.length) {
    return null;
  }

  const strings = meta.docs.map((d) => d.toString().trim());
  const firstEmpty = strings.findIndex((d) => !d.length);
  const combined = (
    firstEmpty === -1
      ? strings
      : strings.slice(0, firstEmpty)
  ).join(' ').replace(/#(<weight>| <weight>).*<\/weight>/, '');
  const parts = splitParts(combined.replace(/\\/g, '').replace(/`/g, ''));

  return [
    parts[0].split(/[.(]/)[0],
    <>{parts.map((part, index) => index % 2 ? <em key={index}>[{part}]</em> : <span key={index}>{part}</span>)}&nbsp;</>
  ];
}

// 块的目标创建时间
const useBlockTargetTime = () => {
  const api = useAtomValue(apiPromiseAtom)

  return useMemo(
    () => {
      const time = calcTargetTime(api)
      const timeInfos = calcTargetTimeInfo(time)
      return timeInfos
    },
    [api]
  );
}

interface IndexedEvent {
  indexes: number[];
  record: EventRecord;
}

interface KeyedEvent extends IndexedEvent {
  blockHash?: string;
  blockNumber?: BlockNumber;
  key: string;
}

interface EventInfos {
  eventCount: number;
  events: KeyedEvent[];
}

interface PrevHashes {
  block: string | null;
  event: string | null;
}

const DEFAULT_EVENT_INFOS: EventInfos = {
  eventCount: 0,
  events: [],
}
const MAX_EVENTS = 75;

const manageEvents = async (api: ApiPromise, prev: PrevHashes, records: Vec<EventRecord>, setState: React.Dispatch<React.SetStateAction<EventInfos>>): Promise<void> => {
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
      );

      if (prev) {
        prev.indexes.push(...e.indexes);
      } else {
        combined.push(e);
      }

      return combined;
    }, [])
    // 倒序
    .reverse();

  // 2. 将事件列表 hash 一下，方便与之前的事件列表进行比较
  const newEventHash = xxhashAsHex(stringToU8a(stringify(newEvents)));

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

      setState(({ events }) => ({
        // 更新事件数量
        eventCount: records.length,
        // 更新事件，保留不同块的之前的事件
        events: [
          ...newEvents.map(({ indexes, record }): KeyedEvent => ({
            blockHash,
            blockNumber,
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
    // 4. 事件列表与之前的相同或为空数组
    setState(({ events }) => ({
      // 事件数量更新
      eventCount: records.length,
      // 事件保持原来的不变
      events
    }));
  }
}

// 获取符合要求的事件
const useEventInfos = () => {
  const api = useAtomValue(apiPromiseAtom)
  const [eventInfos, setEventInfos] = useState<EventInfos>(DEFAULT_EVENT_INFOS)
  const prevHashes = useRef({ block: null, event: null })

  useEffect(() => {
    let subscriber: Promise<Codec>
    const init = async () => {
      await api.isReady
      subscriber = api.query.system.events((records: Vec<EventRecord>) => {
        if (records) {
          manageEvents(api, prevHashes.current, records, setEventInfos)
            .catch(console.error)
        }
      })
    }
    init()
    return () => {
      subscriber?.then(unsubscribe => (unsubscribe as unknown as Function)())
    }
  }, [api, prevHashes])

  return eventInfos
}

// 获取最近的块列表
interface HeaderExtendedWithMapping extends HeaderExtended {
  authorFromMapping?: string;
}
interface Authors {
  byAuthor: Record<string, string>;
  eraPoints: Record<string, string>;
  lastBlockAuthors: string[];
  lastBlockNumber?: string;
  lastHeader?: HeaderExtendedWithMapping;
  lastHeaders: HeaderExtendedWithMapping[];
}
const byAuthor: Record<string, string> = {};
const eraPoints: Record<string, string> = {};
const MAX_HEADERS = 75;
const useRecentBlocks = () => {
  const api = useAtomValue(apiPromiseAtom)
  const [recentBlocks, setRecentBlocks] = useState<Authors>({ byAuthor, eraPoints, lastBlockAuthors: [], lastHeaders: [] })

  useEffect(() => {
    let subscriber: UnsubscribePromise
    const init = async () => {
      await api.isReady

      let lastHeaders: HeaderExtendedWithMapping[] = [];
      let lastBlockAuthors: string[] = [];
      let lastBlockNumber = '';

      subscriber = api.derive.chain.subscribeNewHeads(lastHeader => {
        if (lastHeader?.number) {
          const blockNumber = lastHeader.number.unwrap()
          let thisBlockAuthor = ''

          if (lastHeader.author) {
            thisBlockAuthor = lastHeader.author.toString()
          }

          const thisBlockNumber = formatNumber(blockNumber)

          if (thisBlockAuthor) {
            byAuthor[thisBlockAuthor] = thisBlockNumber;

            if (thisBlockNumber !== lastBlockNumber) {
              lastBlockNumber = thisBlockNumber;
              lastBlockAuthors = [thisBlockAuthor];
            } else {
              lastBlockAuthors.push(thisBlockAuthor);
            }
          }

          lastHeaders = lastHeaders
            .filter((old, index) => index < MAX_HEADERS && old.number.unwrap().lt(blockNumber))
            .reduce((next, header): HeaderExtendedWithMapping[] => {
              next.push(header);

              return next;
            }, [lastHeader])
            .sort((a, b) => b.number.unwrap().cmp(a.number.unwrap()));

          setRecentBlocks({ byAuthor, eraPoints, lastBlockAuthors: lastBlockAuthors.slice(), lastBlockNumber, lastHeader, lastHeaders });
        }
      })
    }

    init()

    return () => {
      subscriber?.then(unsubscribe => (unsubscribe as unknown as Function)())
    }
  }, [api])

  return recentBlocks
}

const BlockTargetTime = () => {
  const [, text] = useBlockTargetTime();

  return (
    <>
      {
        (text as string).split(' ').map((value, index) =>
          <span
            key={index}
          >{value}</span>
        )
      }
    </>
  )
}

interface BlockPanelHeaderProps {
  eventCount: number
}

const BlockPanelHeader = (props: BlockPanelHeaderProps) => {
  const { eventCount } = props;
  const localNow = useLocalNow()
  const lastBlockTime = useLastBlockTime()
  const lastBlockFromCreateToNowTime = getLastBlockFromCreateToNowTime(localNow, lastBlockTime)

  return (
    <Flex>
      <Box paddingRight={2}>
        <Text align="right">last block</Text>
        <Text align="right">{lastBlockFromCreateToNowTime}</Text>
      </Box>
      <Box>
        <Text align="right">target</Text>
        <Text align="right">
          <BlockTargetTime />
        </Text>
      </Box>
      <Spacer />
      <Box>
        <Text align="right">last events</Text>
        <Text align="right">{formatNumber(eventCount)}</Text>
      </Box>
    </Flex>
  )
}

const getAddressMeta = (address: string, type: KeyringItemType | null = null): KeyringJson$Meta => {
  let meta: KeyringJson$Meta | undefined;

  try {
    const pair = keyring.getAddress(address, type);

    meta = pair && pair.meta;
  } catch (error) {
    // we could pass invalid addresses, so it may throw
  }

  return meta || {};
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

  return meta.name
    ? [false, meta.name.toUpperCase()]
    : [true, toShortAddress(address)];
}

interface AccountNameProps {
  value?: AccountId;
}

const AccountName = (props: AccountNameProps) => {
  const { value } = props;
  
  if (!value) {
    return null
  }

  const accountId = value.toString()
  const [isAddressExtracted, displayName] = getAddressName(accountId)
  const tip = `Name is ${isAddressExtracted ? 'Online' : 'Local'}: ${displayName}`

  return (
    <Tooltip label={tip}>
      <Text noOfLines={1}>{displayName}</Text>
    </Tooltip>
  )
}

const getContractAbi = (api: ApiPromise, address: string | null): Abi | null => {
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

interface EventDetailProps {
  value: Event
}

interface Value {
  isValid: boolean;
  value: Codec;
}

interface AbiEvent extends DecodedEvent {
  values: Value[];
}

const EventDetail = (props: EventDetailProps) => {
  const { value } = props
  const api = useAtomValue(apiPromiseAtom)

  console.log('EventDetail value', value)

  // if (!value.data.length) {
  return <Text>TODO</Text>
  // }

  // const abiEvent = useMemo(
  //   (): AbiEvent | null => {
  //     // for contracts, we decode the actual event
  //     if (value.section === 'contracts' && value.method === 'ContractExecution' && value.data.length === 2) {
  //       // see if we have info for this contract
  //       const [accountId, encoded] = value.data;

  //       try {
  //         const abi = getContractAbi(api, accountId.toString());

  //         if (abi) {
  //           const decoded = abi.decodeEvent(encoded as Bytes);

  //           return {
  //             ...decoded,
  //             values: decoded.args.map((value) => ({ isValid: true, value }))
  //           };
  //         }
  //       } catch (error) {
  //         // ABI mismatch?
  //         console.error(error);
  //       }
  //     }

  //     return null;
  //   },
  //   [value]
  // );

  // console.log('abiEvent', abiEvent)

  // return (
  //   <Box>
  //     <Text>{abiEvent?.event.identifier}</Text>
  //     <Text>{JSON.stringify(abiEvent?.values)}</Text>
  //   </Box>
  // )
}

interface BlockPanelMainProps {
  events: KeyedEvent[]
}

const BlockPanelMain = (props: BlockPanelMainProps) => {
  const { events } = props
  const { lastHeaders } = useRecentBlocks()
  const headers = lastHeaders.filter(header => !!header)

  console.log('BlockPanelMain events', events)

  return (
    <Flex gap="10">
      <List spacing={3} title="recent blocks" w="50%" h="300" overflowY="auto" padding={3} tw="bg-black">
        <ListItem key="recent-block-title">
          <Text>Recent Blocks</Text>
        </ListItem>
        {
          headers.map(header => {
            const hashHex = header.hash.toHex()
            const author = header.author

            return (
              <ListItem key={header.number.toString()}>
                <Flex>
                  <Text marginRight={2}>{formatNumber(header.number)}</Text>
                  <Tooltip label={hashHex}>
                    <Text flexGrow={1} noOfLines={1} maxWidth="100%" marginRight={2}>{hashHex}</Text>
                  </Tooltip>
                  <Identicon
                    size={24}
                    value={author}
                    tw="mr-2"
                  />
                  <AccountName value={author as unknown as AccountId} />
                </Flex>
              </ListItem>
            )
          })
        }
      </List>
      <Accordion title="recent events" w="50%" h="300" gap={3} padding={3} overflowY="auto" allowMultiple tw="bg-black">
        <p tw="pb-3">Recent Events</p>
        {
          events.map(event => {
            const { blockNumber, indexes, key, record } = event
            const eventName = `${record.event.section}.${record.event.method}`
            const headerSubInfo = formatMeta(record.event.meta)
            const displayIndexesLength = `${formatNumber(indexes.length)}x`
            const displayBlockNumber = `${formatNumber(blockNumber)}-${indexes[0]}`

            return (
              <AccordionItem key={key}>
                <Flex>
                  <Box as="span" flex='1' textAlign='left'>
                    <Tooltip label={eventName}>
                      <Text noOfLines={1} fontWeight="bold">{eventName}</Text>
                    </Tooltip>
                    { headerSubInfo && (
                      <Tooltip label={headerSubInfo[0]}>
                        <Text noOfLines={1}>{headerSubInfo[0]}</Text>
                      </Tooltip>
                    )}
                  </Box>
                  <AccordionButton w="auto" px="2">
                    <AccordionIcon />
                  </AccordionButton>
                  <Spacer />
                  <Center>
                    <Text noOfLines={1}>
                      {indexes.length !== 1 && <span>({displayIndexesLength}x)&nbsp;</span>}
                      {displayBlockNumber}
                    </Text>
                  </Center>
                </Flex>
                <AccordionPanel>
                  <EventDetail value={record.event} />
                </AccordionPanel>
              </AccordionItem>
            )
          })
        }
      </Accordion>
    </Flex>

  )
}

const BlockPanel = () => {
  const { eventCount, events } = useEventInfos()

  return (
    <div tw="pb-5">
      <BlockPanelHeader eventCount={eventCount} />
      <BlockPanelMain events={events} />
    </div>
  )
}

export default BlockPanel