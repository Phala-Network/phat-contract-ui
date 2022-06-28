import type { FC } from 'react'
import type { MethodRunResult } from '@/features/chain/atoms'

import tw from 'twin.macro'
import { atom, useAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import { TiTimes, TiArrowRepeat, TiMessageTyping } from 'react-icons/ti'
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react'

import { countsAtom } from '@/features/chain/atoms'
import EventPanel from './event-panel'
import ResultPanel from './result-panel'

const toggleEventListAtom = atom<boolean>(false)
const currentTabAtom = atom<number>(0)

const CloseButton = () => {
  const setShowEventList = useUpdateAtom(toggleEventListAtom)
  return (
    <button
      tw="absolute top-2 right-0 p-1 rounded bg-gray-900 hover:bg-phalaDark-500 hover:text-black"
      onClick={() => setShowEventList(false)}
    >
      <TiTimes tw="text-lg" />
    </button>
  )
}

const CounterButton = tw.button`
  flex gap-1 min-w-[2.5rem] justify-center transition-colors text-gray-400 hover:bg-phalaDark-500 hover:text-black
`

const Counters = () => {
  const counts = useAtomValue(countsAtom)
  const setShowEventList = useUpdateAtom(toggleEventListAtom)
  const setCurrentTab = useUpdateAtom(currentTabAtom)
  return (
    <div tw="flex flex-row gap-1">
      <CounterButton
        onClick={() => {
          setShowEventList(true)
          setCurrentTab(0)
        }}
      >
        <TiArrowRepeat tw="text-base" />
        <span tw="text-sm font-mono">{counts.eventCount}</span>
      </CounterButton>
      <CounterButton
        onClick={() => {
          setShowEventList(true)
          setCurrentTab(1)
        }}
      >
        <TiMessageTyping tw="text-base" />
        <span tw="text-sm font-mono">{counts.resultCount}</span>
      </CounterButton>
    </div>
  )
}

export default function StatusBar() {
  const showEventList = useAtomValue(toggleEventListAtom)
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom)
  return (
    <footer css={[tw`flex-shrink bg-black max-w-full px-4`]}>
      <div css={[showEventList ? tw`h-0 hidden` : tw`h-8`]}>
        <div tw="mx-auto h-full w-full max-w-7xl transition-all flex items-center">
          <Counters />
        </div>
      </div>
      <div
        css={[
          tw`flex flex-row bg-black mx-auto w-full max-w-7xl transition-all`,
          showEventList ? tw`h-[30vh]` : tw`h-0 overflow-hidden`,
        ]}
      >
        <Tabs tw="w-full" colorScheme="phalaDark" index={currentTab} onChange={i => setCurrentTab(i)}>
          <TabList tw="relative">
            <Tab>
              <TiArrowRepeat tw="text-gray-400 text-base mr-1" />
              Events
            </Tab>
            <Tab>
              <TiMessageTyping tw="text-gray-400 text-base mr-1" />
              Result
            </Tab>
            <CloseButton />
          </TabList>
          <TabPanels>
            <TabPanel px="0">
              <EventPanel />
            </TabPanel>
            <TabPanel px="0">
              <ResultPanel />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </footer>
  )
}
