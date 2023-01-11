/**
 * @file 块相关的信息面板，https://www.notion.so/phalanetwork/a475b91c6a12455a8f7635dfc56bd2d3
 */

import { useEffect, useState } from 'react'
import { Center, Flex, Text, List, ListItem } from '@chakra-ui/react'
import { useAtomValue } from 'jotai';
import { apiPromiseAtom } from '@/features/parachain/atoms';
import { Moment } from '@polkadot/types/interfaces';

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