import React, { Suspense, useCallback } from 'react'
import tw from 'twin.macro'
import { atom, useAtom, useAtomValue } from 'jotai'
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
  Button,
  IconButton,
  Input,
  Editable,
  EditableInput,
  EditablePreview,
  useEditableControls,
} from "@chakra-ui/react";
import { BiEdit } from 'react-icons/bi';
import Decimal from 'decimal.js'

import signAndSend from '@/functions/signAndSend'
import { atomWithQuerySubscription } from '@/features/parachain/atomWithQuerySubscription';
import { apiPromiseAtom } from '@/features/parachain/atoms';
import Code from '@/components/code'

import { currentContractAtom, phalaFatContractQueryAtom } from '../atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms';

const contractTotalStakesAtom = atomWithQuerySubscription<number>((get, api, subject) => {
  const { contractId } = get(currentContractAtom)
  if (contractId) {
    const multiplier = new Decimal(10).pow(api.registry.chainDecimals[0])
    return api.query.phalaFatTokenomic.contractTotalStakes(contractId, (stakes) => {
      const value = new Decimal(stakes.toString()).div(multiplier)
      subject.next(value.toNumber())
    })
  }
})

const isSavingAtom = atom(false)

const contractStakingAtom = atom(
  get => get(contractTotalStakesAtom),
  async (get, set, value: string) => {
    set(isSavingAtom, true)
    const api = get(apiPromiseAtom)
    const { contractId } = get(currentContractAtom)
    const account = get(currentAccountAtom)
    const signer = get(signerAtom)
    const theNumber = new Decimal(value).mul(new Decimal(10).pow(api.registry.chainDecimals[0]))
    if (account && signer) {
      await signAndSend(api.tx.phalaFatTokenomic.adjustStake(contractId, theNumber.toString()), account.address, signer)
      set(isSavingAtom, false)
    }
  }
)

const useContractMetaExport = () => {
  const contract = useAtomValue(currentContractAtom)
  return useCallback(() => {
    const meta = contract.metadata
    // @ts-ignore
    meta.phat = { contractId: contract.contractId }
    var element = document.createElement('a');
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(meta)));
    element.setAttribute('download', `${contract.metadata.contract.name}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [contract])
}

const StyledTd = tw(Td)`py-4`

const StakeEditControls = () => {
  const {
    isEditing, getSubmitButtonProps, getCancelButtonProps, getEditButtonProps,
  } = useEditableControls()
  const isSaving = useAtomValue(isSavingAtom)
  return isEditing ? (
    <>
      <Button size='sm' {...getSubmitButtonProps()}>OK</Button>
      <Button size='sm' {...getCancelButtonProps()}>Cancel</Button>
    </>
  ) : (
    <>
      <IconButton
        aria-label='Set Stakes'
        size='sm'
        isLoading={isSaving}
        {...getEditButtonProps()}
      >
        <BiEdit tw='text-gray-400 text-lg' />
      </IconButton>
    </>
  )
}

const StakingCell = () => {
  const [stakes, setStakes] = useAtom(contractStakingAtom)
  return (
    <StyledTd>
      <Editable
        defaultValue={`${stakes}`}
        onSubmit={async (val) => { await setStakes(val) }}
        isPreviewFocusable={false} tw='flex flex-row gap-2 items-center'
      >
        <EditablePreview />
        <Input as={EditableInput} size='sm' maxW='12rem' />
        <StakeEditControls />
      </Editable>
    </StyledTd>
  )
}

const ContractInfo = () => {
  const contract = useAtomValue(currentContractAtom)
  const query = useAtomValue(phalaFatContractQueryAtom)
  const handleExport = useContractMetaExport()
  if (!contract)  {
    return null
  }
  return (
    <Box borderWidth="1px" overflow="hidden" my="4" p="8" bg="gray.800">
      <div tw="mb-8 flex justify-between items-center">
        <Heading tw="flex flex-row items-center">
          {contract.metadata.contract.name}
          <Tag tw="ml-4 mt-1">{contract.metadata.contract.version}</Tag>
        </Heading>
        <Button onClick={handleExport}>Export</Button>
      </div>
      <TableContainer>
        <Table size="sm" colorScheme="phalaDark">
          <Tbody>
            <Tr>
              <Th>Contract ID</Th>
              <StyledTd><Code>{contract.contractId}</Code></StyledTd>
            </Tr>
            <Tr>
              <Th>Code Hash</Th>
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
                  <Th>ClusterId</Th>
                  <StyledTd><Code>{query.cluster}</Code></StyledTd>
                </Tr>
              </>
            )}
            <Tr>
              <Th>Stakes</Th>
              <Suspense>
                <StakingCell />
              </Suspense>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ContractInfo