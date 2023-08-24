import React, { Suspense, useCallback, useMemo, useState, useEffect } from 'react'
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
  useToast,
} from "@chakra-ui/react";
import { BiEdit, BiCopy } from 'react-icons/bi';
import { MdOpenInNew } from 'react-icons/md'
import Decimal from 'decimal.js'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Link, useMatch } from '@tanstack/react-location'

import signAndSend from '@/functions/signAndSend'
import { atomWithQuerySubscription } from '@/features/parachain/atomWithQuerySubscription';
import { apiPromiseAtom, websocketConnectionMachineAtom } from '@/features/parachain/atoms';
import Code from '@/components/code'
import { Alert } from '@/components/ErrorAlert'

import { currentContractV2Atom, currentContractIdAtom } from '../atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms';
import { endpointAtom } from '@/atoms/endpointsAtom';

const contractTotalStakesAtom = atomWithQuerySubscription<number>((get, api, subject) => {
  const contractId = get(currentContractIdAtom)
  if (contractId) {
    const multiplier = new Decimal(10).pow(api.registry.chainDecimals[0])
    return api.query.phalaPhatTokenomic.contractTotalStakes(contractId, (stakes) => {
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
    const contractId = get(currentContractIdAtom)
    const account = get(currentAccountAtom)
    const signer = get(signerAtom)
    const theNumber = new Decimal(value).mul(new Decimal(10).pow(api.registry.chainDecimals[0]))
    if (account && signer) {
      // @ts-ignore
      await signAndSend(api.tx.phalaPhatTokenomic.adjustStake(contractId, theNumber.toString()), account.address, signer)
      set(isSavingAtom, false)
    }
  }
)

//
//
//

const useContractMetaExport = () => {
  const fetched = useAtomValue(currentContractV2Atom)

  const download = useCallback(() => {
    if (!fetched.metadata) {
      return
    }
    const meta = fetched.metadata
    // @ts-ignore
    meta.phat = { contractId: contract.contractId }
    var element = document.createElement('a');
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(meta)));
    element.setAttribute('download', `${fetched.metadata.contract.name}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [fetched])

  const canExport = useMemo(() => !!fetched.metadata, [fetched])

  return { canExport, download }
}

//
//
//

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


//
//
//

function useSwitchRpcConfirm(target: Nullable<string>) {
  const [currentEndpoint, setCurrentEndpoint] = useAtom(endpointAtom)
  const [machine, send] = useAtom(websocketConnectionMachineAtom)
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
  const match = useMatch()
  const rpc = match.search?.rpc as Nullable<string>
  const { needSwitch, switchRpc } = useSwitchRpcConfirm(rpc)

  const currentAccount = useAtomValue(currentAccountAtom)
  const fetched = useAtomValue(currentContractV2Atom)
  const toast = useToast()

  const isDeployer = !!(currentAccount?.address === fetched.deployer && fetched.deployer)
  const { canExport, download } = useContractMetaExport()

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
        <Button isDisabled={!canExport} onClick={download}>Export</Button>
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
                <StakingCell />
              </Suspense>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
}
