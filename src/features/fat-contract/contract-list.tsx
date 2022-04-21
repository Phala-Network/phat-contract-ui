import type { FC } from 'react'
import type { LocalContractInfo } from './atoms'

import React from 'react'
import tw from 'twin.macro'
import { atom } from 'jotai'
import { Box } from '@chakra-ui/react'
import { useAtomValue } from 'jotai/utils'
import { Link } from '@tanstack/react-location'

import { contractsAtom } from './atoms'


const ContractCell: FC<LocalContractInfo> = ({ contractId, metadata, createdAt }) => {
  return (
    <Link to={`/contracts/view/${contractId}`}>
      <Box borderWidth='1px' borderRadius='lg' overflow='hidden' my="2" p="2" bg="gray.800">
        <div tw="font-mono text-xs text-gray-400">
          {metadata.source.hash.substring(0, 6)}...{metadata.source.hash.substring(metadata.source.hash.length - 6)}
        </div>
        <header tw="flex flex-row items-center">
          <h4 tw="text-lg">{metadata.contract.name}</h4>
          <div tw="mt-1 ml-2 text-sm text-gray-200">{metadata.contract.version}</div>
        </header>
      </Box>
    </Link>
  )
}

const ContractList = () => {
  const contracts = useAtomValue(contractsAtom)
  if (Object.entries(contracts).length === 0) {
    return null
  }
  return (
    <div tw="mt-2 mb-4 mx-4 bg-black p-4 max-w-4xl min-w-full">
      {Object.entries(contracts).map(([key, info], index) => (
        <div key={index}>
          <ContractCell {...info} />
        </div>
      ))}
    </div>
  )
}

export default ContractList