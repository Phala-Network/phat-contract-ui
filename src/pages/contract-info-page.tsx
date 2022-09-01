import React, { Suspense, useEffect } from 'react'
import tw from 'twin.macro'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
} from "@chakra-ui/react"
import { useAtom } from "jotai"
import { Link } from '@tanstack/react-location'
import { BiChevronRight } from 'react-icons/bi'
import { useMatch } from '@tanstack/react-location'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'

import { currentContractIdAtom, currentContractAtom, pruntimeURLAtom } from '@/features/chain/atoms'
import ContractInfo from '@/features/fat-contract/contract-info'
import ContractMethodGrid from '@/features/fat-contract/contract-method-grid'


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

const PRuntimeUrlField = () => {
  const [endpoint, setEndpoint] = useAtom(pruntimeURLAtom)
  return (
    <FormControl tw="bg-transparent border mb-4">
      <FormLabel tw="p-4 pb-0 w-full text-white bg-transparent">PRuntime Endpoint</FormLabel>
      <div tw="pt-2 px-4 pb-4">
        <InputGroup>
          <Input
            pr="5.5rem"
            css={tw`text-sm font-mono bg-gray-200 outline-none`}
            type='text'
            value={endpoint}
            onChange={ev => setEndpoint(ev.target.value)}
          />
        </InputGroup>
      </div>
    </FormControl>
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
      <PRuntimeUrlField />
      <Suspense fallback={<div />}>
        <ContractMethodGrid />
      </Suspense>
    </div>
  )
}

export default ContractInfoPage