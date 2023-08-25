import React, { Suspense, useEffect } from 'react'
import tw from 'twin.macro'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Skeleton,
} from "@chakra-ui/react"
import { Link } from '@tanstack/react-location'
import { BiChevronRight } from 'react-icons/bi'
import { useMatch } from '@tanstack/react-location'
import { useAtomValue } from 'jotai'
import { ErrorBoundary } from 'react-error-boundary'

import Code from '@/components/code'
import { ErrorAlert } from '@/components/ErrorAlert'
import { currentContractIdAtom, currentContractAtom } from '@/features/phat-contract/atoms'
import ContractInfo from '@/features/phat-contract/components/contract-info'
import ContractMethodGrid from '@/features/phat-contract/components/contract-method-grid'


const CurrentContractName = () => {
  const contractId = useAtomValue(currentContractIdAtom)
  const contract = useAtomValue(currentContractAtom)
  if (!contract) {
    return (
      <BreadcrumbItem>
        <BreadcrumbLink>
          <Code>
            {contractId.substring(0, 8)}...{contractId.substring(contractId.length-8, contractId.length)}
          </Code>
        </BreadcrumbLink>
      </BreadcrumbItem>
    )
  }
  return (
    <BreadcrumbItem>
      <BreadcrumbLink>{contract.metadata.contract.name}</BreadcrumbLink>
    </BreadcrumbItem>
  )
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  if (error.message.indexOf('createType') !== -1) {
    return (
      <Alert status="info" borderRadius={4} flexDir="column" alignItems="start" gap={2}>
        <div tw="flex flex-row items-center">
          <AlertIcon />
          <AlertTitle>Invalid Contract ID</AlertTitle>
        </div>
        <div tw="flex flex-col w-full pr-4">
          <AlertDescription>
            <p>
              The contract ID you provided is invalid. Please check the contract ID and try again.
            </p>
          </AlertDescription>
        </div>
      </Alert>
    )
  }
  return ErrorAlert({ error, resetErrorBoundary })
}

export default function ContractInfoPage () {
  const { params: { contractId } } = useMatch()
  // const setCurrentContractId = useUpdateAtom(currentContractIdAtom)
  // useEffect(() => {
  //   setCurrentContractId(contractId)
  // }, [ contractId, setCurrentContractId ])
  return (
    <div>
      <Breadcrumb separator={<BiChevronRight color="gray.500" />} tw="mb-4">
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} href='/' to="/">Contracts</BreadcrumbLink>
        </BreadcrumbItem>
        <CurrentContractName />
      </Breadcrumb>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense fallback={<Skeleton noOfLines={4} minW="100%" minH="5rem" />}>
          <ContractInfo />
        </Suspense>
        <Suspense fallback={<div />}>
          <ContractMethodGrid contractId={contractId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}