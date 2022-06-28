import React, { Suspense, useState } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { useAtomValue } from 'jotai/utils'

import { lastSelectedAccountAtom } from '@/features/account/atoms'
import { rpcApiStatusAtom } from '@/features/chain/atoms'
import { useUploadCodeAndInstantiate } from '@/features/chain/atoms'
import { candidateAtom, clusterIdAtom } from './atoms'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'
import ClusterIdField from './cluster-id-field'

const SubmitButton = () => {
  const account = useAtomValue(lastSelectedAccountAtom)
  const candidate = useAtomValue(candidateAtom)
  const clusterId = useAtomValue(clusterIdAtom)
  const status = useAtomValue(rpcApiStatusAtom)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const uploadCodeAndInstantiate = useUploadCodeAndInstantiate()
  
  const handleSubmit = async () => {
    if (!account) {
      toast({
        title: 'Please select an account first.',
        status: 'error',
        duration: 9000,
        isClosable: true,
      })
      return
    }
    if (!candidate) {
      toast({
        title: 'Please choose a contract file first.',
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
        {/* <RpcEndpointField />
        <AccountSelectField /> */}
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