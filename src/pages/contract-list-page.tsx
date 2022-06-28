import { FC, Suspense } from 'react'
import type { LocalContractInfo } from '@/features/chain/atoms'

import React from 'react'
import tw from 'twin.macro'
import { useAtomValue } from 'jotai/utils'
import { Box, Button, Stack, Skeleton } from '@chakra-ui/react'
import { Link } from '@tanstack/react-location'

import { hasConnectedAtom, availableContractsAtom } from '@/features/chain/atoms'

const ContractListSkeleton = () => (
  <Stack tw="mt-2 mb-4 bg-black p-4 max-w-4xl min-w-full">
    <Box borderWidth='1px' borderRadius='lg' overflow='hidden' my="2" bg="gray.800">
      <Skeleton height='48px' />
    </Box>
  </Stack>
)

const ContractCell: FC<LocalContractInfo> = ({ contractId, metadata, savedAt }) => {
  // convert timestamp savedAt to human readable datetime string
  let dateString = null
  if (savedAt) {
    const date = new Date(savedAt)
    dateString = date.toLocaleString()
  }
  return (
    <Link to={`/contracts/view/${contractId}`}>
      <Box borderWidth='1px' borderRadius='lg' overflow='hidden' my="2" p="2" bg="gray.800" tw="flex flex-row justify-between">
        <div>
          <div tw="font-mono text-xs text-gray-400">
            {contractId.substring(0, 6)}...{contractId.substring(contractId.length - 6)}
          </div>
          <header tw="flex flex-row items-center">
            <h4 tw="text-lg">{metadata.contract.name}</h4>
            <div tw="mt-1 ml-2 text-sm text-gray-200">{metadata.contract.version}</div>
          </header>
        </div>
        <div>
          {dateString && (
            <div tw="text-sm text-gray-400">{dateString}</div>
          )}
        </div>
      </Box>
    </Link>
  )
}

const ContractList = () => {
  const hasConnected = useAtomValue(hasConnectedAtom)
  const contracts = useAtomValue(availableContractsAtom)
  if (!hasConnected) {
    return <ContractListSkeleton />
  }
  if (contracts.length === 0) {
    return null
  }
  return (
    <div tw="mt-2 mb-4 bg-black p-4 max-w-4xl min-w-full">
      {contracts.map(([key, info]) => (
        <div key={key}>
          <ContractCell {...info} />
        </div>
      ))}
    </div>
  )
}

const ContractListPage = () => {
  return (
    <div tw="grid grid-cols-12 w-full gap-0">
      {/* <div tw="col-span-3 order-2 px-2"></div> */}
      <div tw="col-span-12 order-1 px-2">
        <Link to="/contracts/add">
          <Button bg="black" borderRadius={0} as="span">Add New Contract</Button>
        </Link>
        <Suspense fallback={<ContractListSkeleton />}>
          <ContractList />
        </Suspense>
      </div>
    </div>
  )
}

export default ContractListPage