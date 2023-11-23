import { FC, ReactNode, useEffect, useMemo } from 'react'

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
  Input,
  InputGroup,
} from '@chakra-ui/react'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom, waitForAll } from 'jotai/utils'
import { useNavigate, useLocation } from '@tanstack/react-location'
import { find } from 'ramda'

import { Select } from '@/components/inputs/select'
import { candidateAtom, currentClusterIdAtom, availableClusterOptionsAtom, candidateFileInfoAtom, contractAttachTargetAtom, candidateAllowIndeterminismAtom } from '../atoms'
import useAttachToContract from '../hooks/useAttachToContract'
import ContractFileUpload from './contract-upload'

const ClusterIdSelect = () => {
  const [clusterId, setClusterId] = useAtom(currentClusterIdAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  useEffect(() => {
    if (options && options.length > 0) {
      setClusterId(prev => {
        if (!prev) {
          return options[0].value
        }
        const result = find(i => i.value === prev, options)
        if (!result) {
          return options[0].value
        }
        return prev
      })
    }
  }, [setClusterId, options])
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

const AttachContractField = () => {
  const location = useLocation()
  let defaultContractId = ''
  if (location.current.searchStr) {
    const params = new URLSearchParams(location.current.searchStr)
    defaultContractId = params.get('contractId') || ''
  }
  const [target, setTarget] = useAtom(contractAttachTargetAtom)
  useState(false)
  return (
    <FormControl>
      <FormLabel>Contract Id</FormLabel>
      <InputGroup>
        <Input
            value={target || defaultContractId}
            onChange={ev => setTarget(ev.target.value)}
          />
        </InputGroup>
    </FormControl>
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
  const [candidate, clusterId] = useAtomValue(waitForAll([
    candidateAtom,
    currentClusterIdAtom,
  ]))
  const contractId = useAtomValue(contractAttachTargetAtom)
  const resetContractFileInfo = useResetAtom(candidateFileInfoAtom)
  const resetAllowIndeterminismAtom = useResetAtom(candidateAllowIndeterminismAtom)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const attachToContract = useAttachToContract()
  const navigate = useNavigate()
  const location = useLocation()

  const isValidContractId = useMemo(() => {
    return contractId && contractId.startsWith('0x') && contractId.length === (2 + 32 * 2)
  }, [contractId])
  
  const isDisabled = !(clusterId) || !isValidContractId
  
  const handleSubmit = async () => {
    setIsLoading(true)
    let defaultContractId = ''
    if (location.current.searchStr) {
      const params = new URLSearchParams(location.current.searchStr)
      defaultContractId = params.get('contractId') || ''
    }
    try {
      if (!candidate) {
        toast({
          title: 'Please choose a contract file first.',
          status: 'error',
          duration: 9000,
          isClosable: true,
        })
        return
      }
      if (!contractId && !defaultContractId) {
        toast({
          title: 'Please enter a valid contract address.',
          status: 'error',
          duration: 9000,
          isClosable: true,
        })
        return
      }
      if (candidate) {
        const succeeded = await attachToContract(candidate, clusterId, contractId || defaultContractId)
        resetContractFileInfo()
        resetAllowIndeterminismAtom()
        if (succeeded) {        
          navigate({ to: `/contracts/view/${contractId || defaultContractId}` })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <Button size="lg" onClick={handleSubmit} isDisabled={isDisabled} isLoading={isLoading}>
      Submit
    </Button>
  )
}

const FatContractAttachForm = () => {
  return (
    <div>
      <VStack
        my={4}
        p={4}
        spacing={4}
        align="left"
        bg="gray.700"
      >
        <ContractFileUpload isCheckWASM={false} />
        <SuspenseFormField label="Cluster ID">
          <ClusterIdSelect />
        </SuspenseFormField>
        <AttachContractField />
      </VStack>
      <div tw="mb-4 w-full flex justify-end">
        <Suspense fallback={<Button><Spinner /></Button>}>
          <SubmitButton />
        </Suspense>
      </div>
    </div>
  )
}

export default FatContractAttachForm