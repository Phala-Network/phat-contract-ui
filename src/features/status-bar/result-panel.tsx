import type { FC } from 'react'
import type { MethodRunResult } from '@/features/chain/atoms'

import tw from 'twin.macro'
import { useAtomValue } from 'jotai/utils'
import { Link } from "@tanstack/react-location"
import { TiTick, TiTimes, TiInfoOutline } from 'react-icons/ti'

import { resultsAtom } from '@/features/chain/atoms'

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
          <header tw="flex justify-between pb-2 mb-2 border-b border-solid border-gray-700">
            <Link to={`/contracts/view/${result.contract.contractId}`}>
              <h4 tw="text-sm font-mono px-2 py-1 bg-black rounded-lg inline-block">
                {result.contract.metadata.contract.name}
                .
                {result.methodSpec.label}
              </h4>
              <div tw="text-xs font-mono px-2 my-1 text-gray-400">{result.contract.contractId}</div>
            </Link>
            <time tw="text-sm text-gray-400 mt-1">{completedAtString}</time>
          </header>
          <pre tw="text-base font-mono">
            {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
          </pre>
        </article>
      </div>
    </div>
  )
}

export default function ResultPanel() {
  const queryResults = useAtomValue(resultsAtom)
  return (
    <div tw="h-[30vh] overflow-y-scroll px-6">
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
    </div>
  )
}
