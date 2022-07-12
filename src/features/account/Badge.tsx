import React, { Suspense, useState } from 'react'
import tw from 'twin.macro'
import {
  Avatar,
  AvatarBadge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Input,
  InputGroup,
  FormControl,
  FormLabel,
  FormErrorMessage,
  InputRightElement,
  Button,
} from '@chakra-ui/react'
import { atom, useAtom } from 'jotai'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'
import * as R from 'ramda'

import { rpcEndpointAtom, rpcApiStatusAtom, rpcEndpointErrorAtom, useConnectApi } from '@/features/chain/atoms'

import { lastSelectedAccountDisplayNameAtom, lastSelectedAccountAddressAtom, connectionDetailModalVisibleAtom } from './atoms'
import AccountSelectField from './account-select-field'

const getConnectionStatusColor = R.cond([
  [R.equals('connected'), R.always('green.500')],
  [R.equals('connecting'), R.always('yellow.500')],
  [R.equals('error'), R.always('red.500')],
  [R.T, R.always('gray.500')],
])

const connectionStatusColorAtom = atom(get => {
  const status = get(rpcApiStatusAtom)
  return getConnectionStatusColor(status)
})

const ConnectionStatusBadge = () => {
  const color = useAtomValue(connectionStatusColorAtom)
  return (
    <AvatarBadge boxSize='1.25em' bg={color} />
  )
}

const AccountNameContainer = tw.div`font-semibold text-base`

const AccountName = () => {
  const selected = useAtomValue(lastSelectedAccountAddressAtom)
  const displayName = useAtomValue(lastSelectedAccountDisplayNameAtom)
  if (!selected) {
    return (
      <AccountNameContainer>
        Sign In
      </AccountNameContainer>
    )
  }
  return (
    <AccountNameContainer>
      {displayName}
    </AccountNameContainer>
  )
}

const RpcEndpointField = () => {
  const [endpoint, setEndpoint] = useAtom(rpcEndpointAtom)
  const [input, setInput] = useState(endpoint)
  const [validateError, setValidateError] = useState('')
  const [error, setError] = useAtom(rpcEndpointErrorAtom)
  const status = useAtomValue(rpcApiStatusAtom)
  return (
    <FormControl isInvalid={error !== '' || validateError !== ''}>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">RPC Endpoint</FormLabel>
      <div tw="pt-2 px-4 pb-4">
        <InputGroup>
          <Input
            pr="5.5rem"
            css={tw`text-sm font-mono bg-gray-200 outline-none`}
            type='text'
            value={input}
            onChange={ev => {
              setInput(ev.target.value)
              setValidateError('')
              setError('')
            }}
          />
          <InputRightElement w="5.6rem" mr="1">
            <Button
              tw="bg-black text-gray-300 border border-solid border-[#f3f3f3] hover:bg-[#f3f3f3] hover:text-black"
              h="1.75rem"
              mr="0.3rem"
              size="sm"
              isLoading={status === 'connecting'}
              isDisabled={status === 'connected' && input === endpoint}
              onClick={() => {
                if (input.indexOf('wss://') !== 0 || input.indexOf('ws://') !== 0) {
                  setValidateError('Invalid RPC Endpoint URL')
                  setEndpoint('')
                } else {
                  setEndpoint(input)
                }
              }}
            >
              {status === 'connected' && input === endpoint ? 'connected' : 'connect'}
            </Button>
          </InputRightElement>
        </InputGroup>
        <FormErrorMessage>
          {validateError || error}
        </FormErrorMessage>
      </div>
    </FormControl>
  )
}

const ConnectionModal = () => {
  const [isOpen, setIsOpen] = useAtom(connectionDetailModalVisibleAtom)
  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <ModalOverlay />
      <ModalContent tw="w-full max-w-2xl">
        <ModalHeader>
          Connect to Phala Network
        </ModalHeader>
        <ModalBody tw="text-[#555]">
          <RpcEndpointField />
          <AccountSelectField />
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const TriggerButton = () => {
  const setIsOpen = useUpdateAtom(connectionDetailModalVisibleAtom)
  return (
    <button
      tw="flex flex-row transition-colors p-2 rounded-md min-w-[10rem] hover:bg-gray-800"
      onClick={() => setIsOpen(true)}
    >
      <Avatar size="sm" src="https://app.phala.network/images/Phala.svg">
        <ConnectionStatusBadge />
      </Avatar>
      <div tw="flex flex-col items-start ml-3">
        <div tw="text-xs text-gray-400">Phala Dev</div>
        <Suspense fallback={<AccountNameContainer>Sign In</AccountNameContainer>}>
          <AccountName />
        </Suspense>
      </div>
    </button>
  )
}

export default function AccountBadge() {
  useConnectApi()
  return (
    <>
      <TriggerButton />
      <ConnectionModal />
    </>
  )
}
