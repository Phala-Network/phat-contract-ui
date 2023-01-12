/**
 * @file 块相关的信息面板，https://www.notion.so/phalanetwork/a475b91c6a12455a8f7635dfc56bd2d3
 */

import { useEffect, useMemo, useState } from 'react'
import { Center, Flex, Text, List, ListItem } from '@chakra-ui/react'
import { useAtomValue } from 'jotai';
import { apiPromiseAtom } from '@/features/parachain/atoms';
import { Moment } from '@polkadot/types/interfaces';
import { BN, bnMin, BN_MAX_INTEGER, BN_ONE, BN_THOUSAND, BN_TWO, extractTime } from '@polkadot/util';
import { Time } from '@polkadot/util/types';

const LOCAL_UPDATE_TIME = 100;

// 格式化时间，time 是毫秒的单位
const formatTime = (time: number, type: 's' | 'min' | 'hr' = 's') => {
  let timeFormatted = time
  
  switch (type) {
    case 's':
      timeFormatted = time / 1000
      break

    case 'min':
      timeFormatted = time / 1000 / 60
      break
  
    case 'hr':
      timeFormatted = time / 1000 / 60 / 60
      break

    default:
      break

  }
  
  return timeFormatted.toFixed(4) + type
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

const BlockPanelHeader = () => {
  const localNow = useLocalNow()
  const lastBlockTime = useLastBlockTime()
  const lastBlockFromCreateToNowTime = getLastBlockFromCreateToNowTime(localNow, lastBlockTime)

  return (
    <Flex>
      <Center>
        <Text>last block</Text>
        <Text>{lastBlockFromCreateToNowTime}</Text>
      </Center>
      <Center>
        <Text>target</Text>
        <Text>
          <BlockTargetTime />
        </Text>
      </Center>
    </Flex>
  )
}

const BlockPanelMain = () => {
  return (
    <Flex>
      <List spacing={3}>
        <ListItem>111</ListItem>
      </List>
      <List spacing={3}>
        <ListItem>222</ListItem>
      </List>
    </Flex>

  )
}

const BlockPanel = () => {
  return (
    <div>
      <BlockPanelHeader />
      <BlockPanelMain />
    </div>
  )
}

export default BlockPanel