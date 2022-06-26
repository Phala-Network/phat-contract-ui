import React from 'react'
import tw from 'twin.macro'
import { Button } from '@chakra-ui/react'
import { Link } from '@tanstack/react-location'

import ContractList from '@/features/fat-contract/contract-list'


const ContractListPage = () => {
  return (
    <div tw="flex flex-col items-center w-full">
      <div tw="flex flex-row justify-start w-full">
        <Button bg="black" borderRadius={0} as={Link} to="/contracts/add">Add New Contract</Button>
      </div>
      <ContractList />
    </div>
  )
}

export default ContractListPage