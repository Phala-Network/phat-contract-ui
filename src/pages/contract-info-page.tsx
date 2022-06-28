import React, { Suspense, useEffect } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@chakra-ui/react"
import { Link } from '@tanstack/react-location'
import { BiChevronRight } from 'react-icons/bi'
import { useMatch } from '@tanstack/react-location'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'

import { currentContractIdAtom, currentContractAtom, derviedContractAtom } from '@/features/chain/atoms'
import ContractInfo from '@/features/fat-contract/contract-info'
import ContractQueryGrid from '@/features/fat-contract/contract-query-grid'


const CurrentContractName = () => {
  const contract = useAtomValue(currentContractAtom)
  if (!contract) {
    return null
  }
  return (
    <BreadcrumbItem>
      <BreadcrumbLink>{contract.metadata.contract.name}</BreadcrumbLink>
    </BreadcrumbItem>
  )
}


const DevAbi = () => {
  const contract = useAtomValue(derviedContractAtom)
  console.log(contract?.abi.metadata.registry)
  console.log(contract?.abi.constructors[0].args)
  return (
    <div>Abi</div>
  )
}


const ContractInfoPage = () => {
  const { params: { contractId } } = useMatch()
  const setCurrentContractId = useUpdateAtom(currentContractIdAtom)
  useEffect(() => {
    setCurrentContractId(contractId)
  }, [ contractId, setCurrentContractId ])
  return (
    <div>
      <Breadcrumb separator={<BiChevronRight color="gray.500" />} tw="mb-4">
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} href='/' to="/">Contracts</BreadcrumbLink>
        </BreadcrumbItem>
        <CurrentContractName />
      </Breadcrumb>
      <Suspense fallback={<div />}>
        <ContractInfo />
      </Suspense>
      <Suspense fallback={<div />}>
        <ContractQueryGrid />
      </Suspense>
      {/* <Suspense fallback={<div />}>
        <DevAbi />
      </Suspense> */}
    </div>
  )
}

export default ContractInfoPage