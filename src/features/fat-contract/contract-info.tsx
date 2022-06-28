import React from 'react'
import tw from 'twin.macro'
import { useAtomValue } from 'jotai/utils'
import {
  Box,
  Heading,
  Table,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Tag,
} from "@chakra-ui/react";

import { currentContractAtom, phalaFatContractQueryAtom } from '@/features/chain/atoms'
import Code from '@/features/ui/code'

const StyledTd = tw(Td)`py-4`

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
        <Table size="sm" colorScheme="phalaDark">
          <Tbody>
            <Tr>
              <Th>Contract ID</Th>
              <StyledTd><Code>{contract.contractId}</Code></StyledTd>
            </Tr>
            <Tr>
              <Th>Hash</Th>
              <StyledTd><Code>{contract.metadata.source.hash}</Code></StyledTd>
            </Tr>
            <Tr>
              <Th>Language</Th>
              <StyledTd>{contract.metadata.source.language}</StyledTd>
            </Tr>
            <Tr>
              <Th>Compiler</Th>
              <StyledTd>{contract.metadata.source.compiler}</StyledTd>
            </Tr>
            {query && (
              <>
                <Tr>
                  <Th>Developer</Th>
                  <StyledTd><Code>{query.deployer}</Code></StyledTd>
                </Tr>
                <Tr>
                  <Th>Salt</Th>
                  <StyledTd><Code>{query.salt}</Code></StyledTd>
                </Tr>
                <Tr>
                  <Th>ClusterId</Th>
                  <StyledTd><Code>{query.clusterId}</Code></StyledTd>
                </Tr>
                <Tr>
                  <Th>InstantiateData</Th>
                  <StyledTd><Code>{query.instantiateData}</Code></StyledTd>
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