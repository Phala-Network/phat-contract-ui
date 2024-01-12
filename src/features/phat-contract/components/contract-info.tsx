import React, { Suspense, useCallback, useState, useEffect } from 'react'
import tw from 'twin.macro'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
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
  useToast,
} from "@chakra-ui/react";
import { BiEdit, BiCopy } from 'react-icons/bi';
import { MdOpenInNew } from 'react-icons/md'
import CopyToClipboard from '@/components/CopyToClipboard'
import { Link, useMatch } from '@tanstack/react-location'

import { apiPromiseAtom, websocketConnectionMachineAtom } from '@/features/parachain/atoms';
import Code from '@/components/code'
import { Alert } from '@/components/ErrorAlert'

import { useContractInfoAtom, phatRegistryAtom, ContractInfoDispatch, type ContractInfo as IContractInfo } from '../atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms';
import { endpointAtom } from '@/atoms/endpointsAtom';


const isSavingAtom = atom(false)

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

interface StakingCellProps {
  stakes: number
  setStakes: (value: string) => Promise<void>
}

const StakingCell = ({ stakes, setStakes }: StakingCellProps) => {
  const setIsSaving = useSetAtom(isSavingAtom)
  return (
    <StyledTd>
      <Editable
        defaultValue={`${stakes}`}
        onSubmit={async (val) => {
          setIsSaving(true)
          await setStakes(val)
          setIsSaving(false)
        }}
        isPreviewFocusable={false} tw='flex flex-row gap-2 items-center'
      >
        <EditablePreview />
        <Input as={EditableInput} size='sm' maxW='12rem' />
        <StakeEditControls />
      </Editable>
    </StyledTd>
  )
}


//
//
//

function useSwitchRpcConfirm(target: Nullable<string>) {
  const [currentEndpoint, setCurrentEndpoint] = useAtom(endpointAtom)
  const [_machine, send] = useAtom(websocketConnectionMachineAtom)
  const [needSwitch, setNeedSwitch] = useState(false)

  useEffect(() => {
    if (target && target !== currentEndpoint) {
      setNeedSwitch(true)
    }
  }, [target, currentAccountAtom, setNeedSwitch])

  const switchRpc = useCallback(() => {
    if (target) {
      setCurrentEndpoint(target)
      send({ type: "RECONNECT", data: { endpoint: target } })
    }
  }
  , [target, setCurrentEndpoint])

  return { needSwitch, switchRpc }
}

export default function ContractInfo() {
  // hacks that before migrate to jotai v2
  const _registry = useAtomValue(phatRegistryAtom)
  const _api = useAtomValue(apiPromiseAtom)
  const _signer = useAtomValue(signerAtom)

  const match = useMatch()
  const contractInfoAtom = useContractInfoAtom(match.params.contractId)
  const rpc = match.search?.rpc as Nullable<string>
  const { needSwitch, switchRpc } = useSwitchRpcConfirm(rpc)

  const currentAccount = useAtomValue(currentAccountAtom)
  const [fetched, dispatch]: [IContractInfo | null, ContractInfoDispatch] = useAtom(contractInfoAtom)
  const toast = useToast()

  if (!fetched || fetched.isFetching) {
    return null
  }

  const isDeployer = !!(currentAccount?.address === fetched.deployer && fetched.deployer)

  if (!fetched.found) {
    return (
      <Alert status="info" title="Not CodeHash found for specified Contract ID">
        <p>
          The specified Contract ID was not found in the chain. 
          {needSwitch ? (
            <>It is requesting a switch to <code tw="font-mono text-xs p-1 bg-black rounded">{rpc}</code>. </> 
          ) : ('.')}
        </p>
        {needSwitch ? (
          <Button size="sm" colorScheme="phalaDark" mt="2.5" onClick={switchRpc}>Confirm and Switch</Button>
        ) : null}
      </Alert>
    )
  }
  if (!fetched.metadata) {
    return (
      <Alert status="info" title="No Public Metadata found for specified Contract ID">
        <p>
          The Contract ID you specified is not public metadata found. If you have it, you can attach the custom ABI.
        </p>
        <div>
          <Link to={`/contracts/attach?contractId=${fetched.contractId}`}>
            <Button>Attach</Button>
          </Link>
        </div>
      </Alert>
    )
  }

  return (
    <Box borderWidth="1px" overflow="hidden" my="4" p="8" bg="gray.800">
      <div tw="mb-8 flex justify-between items-center">
        <Heading tw="flex flex-row items-center">
          {fetched.metadata.contract.name}
          <Tag tw="ml-4 mt-1">{fetched.metadata.contract.version}</Tag>
        </Heading>
        <Button isDisabled={!fetched.canExport} onClick={() => dispatch({ type: 'export' })}>Export</Button>
      </div>
      <TableContainer>
        <Table size="sm" colorScheme="phalaDark">
          <Tbody>
            <Tr>
              <Th>Contract ID</Th>
              <StyledTd>
                <div tw="flex flex-row gap-2">
                  <div tw="flex flex-row items-center">
                    <Code>{fetched.contractId}</Code>
                  </div>
                  <CopyToClipboard
                    text={fetched.contractId}
                    onCopy={() => toast({title: 'Copied!'})}
                  >
                    <IconButton aria-label="copy" size="sm"><BiCopy /></IconButton>
                  </CopyToClipboard>
                </div>
              </StyledTd>
            </Tr>
            <Tr>
              <Th>Code Hash</Th>
              <StyledTd>
                <div tw="flex flex-row gap-2">
                  <div tw="flex flex-row items-center">
                    <Code>{fetched.metadata.source.hash}</Code>
                  </div>
                  <CopyToClipboard
                    text={fetched.metadata.source.hash}
                    onCopy={() => toast({title: 'Copied!'})}
                  >
                    <IconButton aria-label="copy" size="sm"><BiCopy /></IconButton>
                  </CopyToClipboard>
                  {fetched.verified ? (
                    fetched.source === 'Phala' ? (
                      <Tag size="sm" colorScheme="green">
                        Provided by Phala
                      </Tag>
                    ) : (
                      <Tag size="sm" colorScheme="green">
                        <a
                          href={`https://patron.works/codeHash/${fetched.codeHash.substring(2)}`}
                          target="_blank"
                        >
                          Verified by {fetched.source}
                        </a>
                        <MdOpenInNew tw="ml-1" />
                      </Tag>
                    )
                  ) :(
                    <Tag size="sm" colorScheme="yellow">
                      unverified
                    </Tag>
                  )}
                </div>
              </StyledTd>
            </Tr>
            <Tr>
              <Th>Build</Th>
              <StyledTd>
                {fetched.metadata.source.compiler}
                <span tw="select-none text-gray-600 mx-1.5">•</span>
                {fetched.metadata.source.language}
              </StyledTd>
            </Tr>
            <Tr>
              <Th>Deployer</Th>
              <StyledTd>{isDeployer ? <Code>YOU</Code> : <Code>{fetched.deployer}</Code>}</StyledTd>
            </Tr>
            <Tr>
              <Th>Stakes</Th>
              <Suspense>
                <StakingCell stakes={fetched.stakes} setStakes={async (value) => dispatch({ type: 'stake', value })} />
              </Suspense>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
}
