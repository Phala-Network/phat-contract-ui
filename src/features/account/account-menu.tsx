import { Suspense } from 'react'
import tw from 'twin.macro'
import { HiChevronDown as ChevronDownIcon, HiOutlineCheck as CheckIcon } from 'react-icons/hi'
import { atom, useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Avatar,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuItemOption,
  Spinner,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@chakra-ui/react'

import { rpcApiInstanceAtom } from '@/atoms/foundation'
import { accountsAtom, extensionEnabledAtom, lastSelectedAccountAtom, balanceAtom } from './atoms'

const AccountMenu = () => {
  const [selected, setSelected] = useAtom(lastSelectedAccountAtom)
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