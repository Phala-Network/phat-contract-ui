import tw from 'twin.macro'
import { useAtomValue } from 'jotai/utils'
import { Avatar } from '@chakra-ui/react'

import { lastSelectedAccountAtom, balanceAtom } from './atoms'

const AccountMenu = () => {
  const selected = useAtomValue(lastSelectedAccountAtom)
  const balance = useAtomValue(balanceAtom)
  if (!selected) {
    return (
    <div tw="flex justify-center items-center">
      <Avatar size="sm" src="https://app.phala.network/images/Phala.svg" />
      <div tw="ml-2 flex flex-col">
        <div tw="font-bold text-base">Sign In</div>
      </div>
    </div>
    )
  }
  return (
    <div tw="flex justify-center items-center">
      <Avatar size="sm" src="https://app.phala.network/images/Phala.svg" />
      <div tw="ml-2 flex flex-col">
        <div tw="font-bold text-base">{selected.meta.name}</div>
        <code tw="font-mono text-xs text-gray-300 leading-none">
          {selected.address.substring(0, 6)}...{selected.address.substring(selected.address.length - 4)}
        </code>
      </div>
    </div>
  )
}

export default AccountMenu