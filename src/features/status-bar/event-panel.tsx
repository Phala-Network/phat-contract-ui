import React from 'react'
import tw from 'twin.macro'
import { useAtomValue, useResetAtom } from 'jotai/utils'
import { Badge } from '@chakra-ui/react'
import * as R from 'ramda'

import { eventsAtom } from '@/features/chain/atoms'

const EventPanel = () => {
  const events = useAtomValue(eventsAtom)
  const reset = useResetAtom(eventsAtom)
  return (
    <div tw="overflow-y-scroll h-[30vh] px-6">
      <div tw="flex flex-col gap-4">
        {events.map((event, index) => (
          <article tw="flex-grow bg-gray-900 border border-solid border-gray-700 rounded-sm px-4 pt-2 pb-3">
            <div tw="mb-2">
              <Badge borderRadius='full' px='2' colorScheme='phala' mr="2">{event.section}</Badge>
              <Badge borderRadius='full' px='2' colorScheme='phalaDark'>{event.method}</Badge>
            </div>
            {event.section === 'balances' && (
              <div tw="px-1 text-xs font-mono">
                <p tw="my-2">{event.data[0] as unknown as string}</p>
                <p tw="my-2">{event.data[1] as unknown as string}</p>
              </div>
            )}
            {event.section === 'treasury' && (
              <div tw="px-1 text-xs font-mono">
                <p tw="my-2">{event.data[0] as unknown as string}</p>
              </div>
            )}
            {event.section === 'phalaFatContracts' && event.method === 'Instantiating' && (
              <div tw="px-1 text-xs font-mono">
                {event.data.map((data, index) => (
                  <p tw="my-2" key={index}>{data as unknown as string}</p>
                ))}
              </div>
            )}
            {event.section === 'system' && event.data.map((rec: object, idx) => (
              <div key={idx} tw="px-1 text-sm font-mono">
                {R.toPairs(rec).map(([key, value]: [string, string]) => (
                  <div tw="my-2" key={key}>{key}: {value}</div>
                ))}
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  )
}

export default EventPanel