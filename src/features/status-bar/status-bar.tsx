import tw from 'twin.macro'
import { atom, useAtom } from 'jotai'

import EventList from './event-list'

const toggleEventListAtom = atom<boolean>(false)

export default function StatusBar() {
  const [showEventList, setShowEventList] = useAtom(toggleEventListAtom)
  return (
    <footer
      css={[
        tw`flex-shrink bg-black cursor-pointer transition-all max-w-full px-4`,
        showEventList ? tw`h-[44vh] pb-2` : tw`h-auto`,
      ]}
      onClick={() => setShowEventList(i => !i)}
    >
      <div
        css={[
          tw`mx-auto w-full max-w-7xl md:flex md:items-center md:justify-between py-2 text-sm`,
        ]}
        >
        Events
      </div>
      <div
        css={[
          tw`flex flex-row bg-black`,
          showEventList ? tw`block` : tw`hidden`,
        ]}
      >
        <EventList />
      </div>
    </footer>
  )
}
