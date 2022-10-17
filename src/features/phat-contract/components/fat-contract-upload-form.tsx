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
  Alert,
  AlertIcon,
  AlertTitle,
} from '@chakra-ui/react'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { useNavigate } from '@tanstack/react-location'

import { Select } from '@/components/inputs/select'
import { currentAccountAtom, currentAccountBalanceAtom } from '@/features/identity/atoms'
import { candidateAtom, currentClusterIdAtom, availableClusterOptionsAtom, candidateFileInfoAtom, pruntimeURLAtom } from '../atoms'
import useUploadCodeAndInstantiate from '../hooks/useUploadCodeAndInstantiate'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'

const ClusterIdSelect = () => {
  const [clusterId, setClusterId] = useAtom(currentClusterIdAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  if (!options.length) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>RPC is not Ready</AlertTitle>
      </Alert>
    )
  }
  return (
    <Select value={clusterId} onChange={setClusterId} options={options} />
  )
}

const SuspenseFormField: FC<{ label: string, children: ReactNode }> = ({ label, children }) => {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <div>
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
  const pruntime = useAtomValue(pruntimeURLAtom)
  const balance = useAtomValue(currentAccountBalanceAtom)
  const resetContractFileInfo = useResetAtom(candidateFileInfoAtom)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const uploadCodeAndInstantiate = useUploadCodeAndInstantiate()
  const navigate = useNavigate()
  
  const isDisabled = !(clusterId && pruntime && balance.gt(1))
  
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
    <Button size="lg" onClick={handleSubmit} isDisabled={isDisabled} isLoading={isLoading}>Submit</Button>
  )
}

const FatContractUploadForm = () => {
  return (
    <div>
      <VStack
        my={4}
        p={4}
        spacing={4}
        align="left"
        bg="gray.700"
      >
        {/* <RpcEndpointField />
        <AccountSelectField /> */}
        <ContractFileUpload />
        <InitSelectorField />
        <SuspenseFormField label="Cluster ID">
          <ClusterIdSelect />
        </SuspenseFormField>
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