import type { FC } from 'react'
import type { MethodRunResult } from '@/features/chain/atoms'

import tw from 'twin.macro'
import { atom, useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import { Link } from "@tanstack/react-location"
import { TiTick, TiTimes } from 'react-icons/ti'

import { resultsAtom } from '@/features/chain/atoms'

import EventList from './event-list'

const toggleEventListAtom = atom<boolean>(true)

const QueryResultHistoryItem: FC<MethodRunResult> = (result) => {
  const completedAt = new Date(result.completedAt)
  const completedAtString = completedAt.toLocaleString()
  return (
    <div>
      <div tw="flex flex-row gap-3">
        <div tw="rounded-full w-8 h-8 bg-gray-900 flex justify-center items-center border border-solid border-gray-800">
          {result.succeed ? <TiTick tw="text-xl text-phala-500" /> : <TiTimes tw="text-xl text-red-500" />}
        </div>
        <article tw="flex-grow bg-gray-900 border border-solid border-gray-700 rounded-sm px-4 pt-2 pb-3">
          <header tw="flex justify-between items-center pb-2 mb-2 border-b border-solid border-gray-700">
            <Link to={`/contracts/view/${result.contract.contractId}`}>
              <h4 tw="text-sm font-mono px-2 py-1 bg-black rounded-lg inline-block">
                {result.contract.metadata.contract.name}
                .
                {result.methodSpec.label}
              </h4>
              <div tw="text-xs font-mono px-2 my-1 text-gray-400">{result.contract.contractId}</div>
            </Link>
            <time tw="text-sm text-gray-400">{completedAtString}</time>
          </header>
          <pre tw="text-base font-mono">
            {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
          </pre>
        </article>
      </div>
    </div>
  )
}

const QueryResultHistory = () => {
  const queryResults = useAtomValue(resultsAtom)
  return (
    <div tw="flex flex-col gap-4">
      {queryResults.map((result, index) => (
        <div key={index}>
          <QueryResultHistoryItem {...result} />
        </div>
      ))}
    </div>
  )
}

export default function StatusBar() {
  const [showEventList, setShowEventList] = useAtom(toggleEventListAtom)
  return (
    <footer
      css={[
        tw`flex-shrink bg-black transition-all max-w-full px-4`,
        showEventList ? tw`h-[44vh] pb-2` : tw`h-auto`,
      ]}
    >
      <div
        onClick={() => setShowEventList(i => !i)}
        css={[
          tw`mx-auto w-full max-w-7xl md:flex md:items-center md:justify-between py-2 text-sm`,
        ]}
        >
        Events
      </div>
      <div
        css={[
          tw`flex flex-row bg-black mx-auto w-full max-w-7xl`,
          showEventList ? tw`block` : tw`hidden`,
        ]}
      >
        {/* <EventList /> */}
        <QueryResultHistory />
      </div>
    </footer>
  )
}
