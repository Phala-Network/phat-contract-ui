import type { FC, ReactNode } from 'react'
import type { LocalContractInfo } from './atoms'

import React from 'react'
import tw from 'twin.macro'
import { atom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import {
  Box,
  Text,
  Heading,
  Table,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
  TableContainer,
  Tag,
} from "@chakra-ui/react";

import { currentContractAtom, phalaFatContractQueryAtom } from './atoms'
import Code from '@/features/ui/code'


const ContractInfo = () => {
  const contract = useAtomValue(currentContractAtom)
  const query = useAtomValue(phalaFatContractQueryAtom)
  if (!contract)  {
    return null
  }
  return (
    <Box borderWidth="1px" overflow="hidden" my="4" p="8" bg="gray.800">
      <Heading tw="mb-8 flex flex-row items-center">
        {contract.metadata.contract.name}
        <Tag tw="ml-4 mt-1">{contract.metadata.contract.version}</Tag>
      </Heading>
      <TableContainer>
        <Table size="sm" colorScheme="phala">
          <Tbody>
            <Tr>
              <Th>Hash</Th>
              <Td><Code>{contract.metadata.source.hash}</Code></Td>
            </Tr>
            <Tr>
              <Th>Language</Th>
              <Td>{contract.metadata.source.language}</Td>
            </Tr>
            <Tr>
              <Th>Compiler</Th>
              <Td>{contract.metadata.source.compiler}</Td>
            </Tr>
            {query && (
              <>
                <Tr>
                  <Th>Developer</Th>
                  <Td><Code>{query.deployer}</Code></Td>
                </Tr>
                <Tr>
                  <Th>Salt</Th>
                  <Td><Code>{query.salt}</Code></Td>
                </Tr>
                <Tr>
                  <Th>ClusterId</Th>
                  <Td><Code>{query.clusterId}</Code></Td>
                </Tr>
                <Tr>
                  <Th>InstantiateData</Th>
                  <Td><Code>{query.instantiateData}</Code></Td>
                </Tr>
              </>
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ContractInfo