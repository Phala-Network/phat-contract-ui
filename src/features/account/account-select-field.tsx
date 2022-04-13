import { Suspense } from 'react'
import tw from 'twin.macro'
import { HiChevronDown as ChevronDownIcon, HiOutlineCheck as CheckIcon } from 'react-icons/hi'
import { useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import {
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuItemOption,
  Spinner,
  FormControl,
  FormLabel,
} from '@chakra-ui/react'

import { accountsAtom, lastSelectedAccountAtom } from './atoms'

function AccountSelectFieldBase() {
  const accounts = useAtomValue(accountsAtom)
  const [selected, setSelected] = useAtom(lastSelectedAccountAtom)
  return (
    <Menu>
      <MenuButton tw="w-full border border-solid border-black" as={Button} rightIcon={<ChevronDownIcon />}>
        {selected ? selected.meta.name : 'Please Select Account First'}
      </MenuButton>
      <MenuList>
        {accounts.map(account => (
          <MenuItem
            key={account.meta.name}
            onClick={() => setSelected(account)}
          >
            <MenuItemOption
              icon={<CheckIcon tw="text-phala-500" />}
              isChecked={account.address === selected?.address}
            >
              <span tw="text-white">{account.meta.name}</span>
              <code tw="ml-1 font-mono text-xs text-gray-500">
                ({account.address.substring(0, 6)}...{account.address.substring(account.address.length - 6)})
              </code>
            </MenuItemOption>
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  )
}

function AccountSelectField() {
  return (
    <FormControl>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">Account</FormLabel>
      <div tw="w-full px-4 mt-4">
        <Suspense fallback={<Button tw="w-full flex items-center justify-center"><Spinner /></Button>}>
          <AccountSelectFieldBase />
        </Suspense>
      </div>
    </FormControl>
  )
}

export default AccountSelectField