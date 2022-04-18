import React from 'react'
import tw from 'twin.macro'
import { useAtomValue, useResetAtom } from 'jotai/utils'
import { Badge, Box, Button } from '@chakra-ui/react'
import * as R from 'ramda'

import { eventsAtom } from './hooks/use-upload-code-and-instantiate'

const EventList = () => {
  const events = useAtomValue(eventsAtom)
  const reset = useResetAtom(eventsAtom)
  if (!events.length) {
    return null
  }
  return (
    <div tw="flex-grow my-4 mx-8 md:ml-2 bg-black p-4 max-w-4xl">
      <div tw="mb-1 pb-3 border-b border-solid border-gray-400 flex flex-row justify-end">
        <Button size="sm" colorScheme="phala" onClick={() => reset()}>clean</Button>
      </div>
      <div tw="overflow-scroll max-h-[560px]">
        {events.map((event, index) => (
          <Box key={index} borderWidth='1px' borderRadius='lg' overflow='hidden' p="2" my="2">
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
          </Box>
        ))}
      </div>
    </div>
  )
}

export default EventList