import React from 'react'
import tw from 'twin.macro'
import { useAtomValue, useResetAtom } from 'jotai/utils'
import { Badge } from '@chakra-ui/react'
import { TiInfoOutline } from 'react-icons/ti'
import * as R from 'ramda'

import { eventsAtom } from '@/features/chain/atoms'

const EventPanel = () => {
  const events = useAtomValue(eventsAtom)
  const reset = useResetAtom(eventsAtom)
  return (
    <div tw="overflow-y-scroll h-[26vh] px-6">
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
    </div>
  )
}

export default EventPanel