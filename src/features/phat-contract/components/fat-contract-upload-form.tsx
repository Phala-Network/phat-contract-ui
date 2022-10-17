import type { FC, ReactNode } from 'react'

import React, { Suspense, useState } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  VStack,
  useToast,
  FormControl,
  FormLabel,
  Skeleton,
} from '@chakra-ui/react'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { useNavigate } from '@tanstack/react-location'

import { Select } from '@/components/inputs/select'
import { currentAccountAtom } from '@/features/identity/atoms'
import { candidateAtom, currentClusterIdAtom, availableClusterOptionsAtom, candidateFileInfoAtom } from '../atoms'
import useUploadCodeAndInstantiate from '../hooks/useUploadCodeAndInstantiate'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'

const ClusterIdSelect = () => {
  const [clusterId, setClusterId] = useAtom(currentClusterIdAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  return (
    <Select value={clusterId} onChange={setClusterId} options={options} />
  )
}

const SuspenseFormFIeld: FC<{ label: string, children: ReactNode }> = ({ label, children }) => {
  return (
    <FormControl>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">{label}</FormLabel>
      <div tw="px-4 mt-4">
        <Suspense fallback={<Skeleton height="40px" />}>
          {children}
        </Suspense>
      </div>
    </FormControl>
  )
}

const SubmitButton = () => {
  const account = useAtomValue(currentAccountAtom)
  const candidate = useAtomValue(candidateAtom)
  const clusterId = useAtomValue(currentClusterIdAtom)
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
    <Button size="lg" onClick={handleSubmit} isLoading={isLoading}>Submit</Button>
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
        <SuspenseFormFIeld label="Cluster ID">
          <ClusterIdSelect />
        </SuspenseFormFIeld>
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