import React, { Suspense, useState } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { useAtomValue, useResetAtom } from 'jotai/utils'
import { useNavigate } from '@tanstack/react-location'

import { lastSelectedAccountAtom } from '@/features/account/atoms'
import { useUploadCodeAndInstantiate, hasConnectedAtom } from '@/features/chain/atoms'
import { candidateAtom, clusterIdAtom, candidateFileInfoAtom } from './atoms'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'
import ClusterIdField from './cluster-id-field'

const SubmitButton = () => {
  const account = useAtomValue(lastSelectedAccountAtom)
  const candidate = useAtomValue(candidateAtom)
  const clusterId = useAtomValue(clusterIdAtom)
  const hasConnected = useAtomValue(hasConnectedAtom)
  const resetContractFileInfo = useResetAtom(candidateFileInfoAtom)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const uploadCodeAndInstantiate = useUploadCodeAndInstantiate()
  const navigate = useNavigate()
  
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
      const contractId = await uploadCodeAndInstantiate(account, candidate, clusterId)
      resetContractFileInfo()
      setIsLoading(false)
      if (contractId) {        
        navigate({ to: `/contracts/view/${contractId}` })
      }
    }
  }
  return (
    <Button size="lg" onClick={handleSubmit} disabled={!hasConnected} isLoading={isLoading}>Submit</Button>
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
        tw="bg-[#f3f3f3] text-[#555]"
      >
        {/* <RpcEndpointField />
        <AccountSelectField /> */}
        <ContractFileUpload />
        <InitSelectorField />
        <ClusterIdField />
        {/* <EventList /> */}
      </VStack>
      <div tw="mb-4 w-full flex justify-end">
        <Suspense fallback={<Button><Spinner /></Button>}>
          <SubmitButton />
        </Suspense>
      </div>
    </div>
  )
}

export default FatContractUploadForm