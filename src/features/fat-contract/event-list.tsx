import React from 'react'
import tw from 'twin.macro'
import { useAtomValue } from 'jotai/utils'
import { Badge, Box } from '@chakra-ui/react'
import * as R from 'ramda'

import { eventsAtom } from './hooks/use-upload-code-and-instantiate'

const EventList = () => {
  const events = useAtomValue(eventsAtom)
  if (!events.length) {
    return null
  }
  return (
    <div tw="flex-grow my-4 mr-8 bg-black p-4 max-w-4xl max-h-[600px] overflow-scroll">
      {events.map((event, index) => (
        <Box key={index} borderWidth='1px' borderRadius='lg' overflow='hidden' p="2" my="2">
          <div tw="mb-2">
            <Badge borderRadius='full' px='2' colorScheme='phala' mr="2">{event.section}</Badge>
            <Badge borderRadius='full' px='2' colorScheme='phalaDark'>{event.method}</Badge>
          </div>
          {event.section === 'balances' && (
            <div tw="px-1 text-xs font-mono">
              <p>{event.data[0] as unknown as string}</p>
              <p>{event.data[1] as unknown as string}</p>
            </div>
          )}
          {event.section === 'treasury' && (
            <div tw="px-1 text-xs font-mono">
              <p>{event.data[0] as unknown as string}</p>
            </div>
          )}
          {event.section === 'phalaFatContracts' && event.method === 'Instantiating' && (
            <div tw="px-1 text-xs font-mono">
              {event.data.map((data, index) => (
                <p key={index}>{data as unknown as string}</p>
              ))}
            </div>
          )}
          {event.section === 'system' && event.data.map((rec: object, idx) => (
            <div key={idx} tw="px-1 text-sm font-mono">
              {R.toPairs(rec).map(([key, value]: [string, string]) => (
                <div key={key}>{key}: {value}</div>
              ))}
            </div>
          ))}
        </Box>
      ))}
    </div>
  )
}

export default EventList