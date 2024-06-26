import React, { Suspense } from 'react'
import tw from 'twin.macro'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Box,
  Heading,
} from '@chakra-ui/react'
import { Link } from '@tanstack/react-location'
import { BiChevronRight } from 'react-icons/bi'

import FatContractUploadForm from '@/features/phat-contract/components/fat-contract-upload-form'


const ContractAddPage = () => {
  return (
    <div>
      <Breadcrumb separator={<BiChevronRight color="gray.500" />} tw="mb-4">
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} href='/' to="/">Contracts</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      <FatContractUploadForm />
    </div>
  )
}

export default ContractAddPage