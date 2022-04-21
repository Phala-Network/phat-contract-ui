import React from 'react'
import tw from 'twin.macro'
import { Box, Heading } from '@chakra-ui/react'

import FatContractUploadForm from '@/features/instantiate/fat-contract-upload-form'


const ContractAddPage = () => {
  return (
    <Box tw="w-full max-w-screen-md mx-auto">
      <Heading tw="mb-4">
        Upload a contract
      </Heading>
      <FatContractUploadForm />
    </Box>
  )
}

export default ContractAddPage