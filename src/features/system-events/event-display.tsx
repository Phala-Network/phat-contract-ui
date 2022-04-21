import tw from 'twin.macro'
import { atom, useAtom } from 'jotai'
import { atomWithStorage, useAtomValue } from 'jotai/utils'
import { Accordion, Tabs, TabList, Tab } from '@chakra-ui/react'

import { useSystemEvents, recentSystemEventsAtom } from '@/atoms/foundation'

import EventCell from './event-cell'

enum EventFilter {
  all,
  phalaFatContracts,
}

const EventFilterOptions = {
  [EventFilter.all]: 'All',
  [EventFilter.phalaFatContracts]: 'Phala Fat Contracts',
}

const currentEventFilterAtom = atomWithStorage<EventFilter>('system-events-filter', EventFilter.all)

const filteredSystemEventsAtom = atom(get => {
  const option = get(currentEventFilterAtom)
  const events = get(recentSystemEventsAtom)
  if (option === EventFilter.all) {
    return events
  }
  return events.filter(rec => rec.event.record.event.section === 'phalaFatContracts')
})

const EventListPanel = () => {
  const events = useAtomValue(filteredSystemEventsAtom)
  return (
    <Accordion allowMultiple allowToggle>
      {events.map((event, index) => (
        <EventCell key={index} event={event.event} details={event.details} />
      ))}
    </Accordion>
  )
}

function EventDisplay() {
  useSystemEvents()
  const [tabIndex, setTabIndex] = useAtom(currentEventFilterAtom)
  return (
    <div tw="flex-grow my-4 mx-8 md:ml-2 bg-black p-4 max-w-4xl">
      <Tabs variant="line" colorScheme="phalaDark" onChange={setTabIndex} index={tabIndex}>
        <TabList>
          {Object.entries(EventFilterOptions).map(([key, value]) => (
            <Tab key={key}>{value}</Tab>
          ))}
        </TabList>
        <EventListPanel />
      </Tabs>
    </div>
  )
}

export default EventDisplay