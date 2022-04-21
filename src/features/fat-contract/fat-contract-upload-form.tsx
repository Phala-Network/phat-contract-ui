import React, { Suspense, useState } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  Input,
  InputGroup,
  FormControl,
  FormLabel,
  FormErrorMessage,
  InputRightElement,
  VStack,
  useToast,
  SimpleGrid,
} from "@chakra-ui/react";
import { useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'

import { lastSelectedAccountAtom } from '@/features/account/atoms'
import { rpcEndpointAtom, rpcApiStatusAtom, rpcEndpointErrorAtom } from '@/atoms/foundation'
import { candidateAtom, clusterIdAtom } from './atoms'
import useUploadCodeAndInstantiate from './hooks/use-upload-code-and-instantiate'
import AccountSelectField from '@/features/account/account-select-field'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'
import EventList from './event-list'

const SubmitButton = () => {
  const account = useAtomValue(lastSelectedAccountAtom)
  const candidate = useAtomValue(candidateAtom)
  const clusterId = useAtomValue(clusterIdAtom)
  const status = useAtomValue(rpcApiStatusAtom)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const uploadCodeAndInstantiate = useUploadCodeAndInstantiate()
  
  const handleSubmit = async () => {
    console.log('handleSubmit', account, candidate)
    if (!account) {
      toast({
        title: 'Please select an account first.',
        // description: "We've created your account for you.",
        status: 'error',
        duration: 9000,
        isClosable: true,
      })
      return
    }
    if (!candidate) {
      toast({
        title: 'Please choose a contract file first.',
        // description: "We've created your account for you.",
        status: 'error',
        duration: 9000,
        isClosable: true,
      })
      return
    }
    if (account && candidate) {
      setIsLoading(true)
      await uploadCodeAndInstantiate(account, candidate, clusterId)
      setIsLoading(false)
    }
  }
  return (
    <Button size="lg" onClick={handleSubmit} disabled={status !== 'connected'} isLoading={isLoading}>Submit</Button>
  )
}

const ClusterIdField = () => {
  const [clusterId, setClusterId] = useAtom(clusterIdAtom)
  return (
    <FormControl>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">Cluster ID</FormLabel>
      <div tw="px-4 mt-4">
        <Input
          css={tw`text-sm font-mono bg-gray-200 outline-none`}
          value={clusterId}
          onChange={(evt) => setClusterId(evt.target.value)}
        />
      </div>
    </FormControl>
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
      <div tw="px-4">
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
                if (input.indexOf('wss://') !== 0) {
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

const FatContractUploadForm = () => {
  return (
    <div>
      <VStack
        my={4}
        pb={8}
        spacing={4}
        align="left"
        tw="bg-[#f3f3f3] text-[#555] mx-8 md:mr-2"
      >
        <RpcEndpointField />
        <AccountSelectField />
        <ContractFileUpload />
        <InitSelectorField />
        <ClusterIdField />
        {/* <EventList /> */}
      </VStack>
      <div tw="px-8 md:pr-2 mb-4 w-full flex justify-end">
        <Suspense fallback={<Button><Spinner /></Button>}>
          <SubmitButton />
        </Suspense>
      </div>
    </div>
  )
}

export default FatContractUploadForm