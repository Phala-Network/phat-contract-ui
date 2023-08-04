import type { FC, ReactNode } from 'react'

import React, { Suspense, useMemo } from 'react'
import tw, { styled } from 'twin.macro'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  VStack,
  FormControl,
  FormLabel,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  Input,
  InputGroup,
  Button,
  ButtonGroup,
  FormErrorMessage,
  Tooltip,
} from '@chakra-ui/react'
import { atom, useAtomValue, useAtom } from 'jotai'
import * as R from 'ramda'

import { Select } from '@/components/inputs/select'
import EndpointAddressInput from '@/features/parachain/components/EndpointAddressInput'
import {
  pruntimeURLAtom,
  currentClusterIdAtom,
  availableClusterOptionsAtom,
  currentWorkerIdAtom,
  availableWorkerListAtom,
  availablePruntimeListAtom,
  currentClusterAtom,
  phatRegistryAtom,
} from '@/features/phat-contract/atoms'
import { websocketConnectionMachineAtom } from '@/features/parachain/atoms'
import Code from './code'

export const connectionDetailModalVisibleAtom = atom(false)

const preferCustomPruntime = atom(false)

const RPCNotReadyAlert = () => {
  return (
    <Alert status="warning">
      <AlertIcon />
      <AlertTitle>RPC is not Ready</AlertTitle>
    </Alert>
  )
}

const ClusterIdSelect = () => {
  const currentClusterId = useAtomValue(currentClusterIdAtom)
  const [currentCluster, setClusterId] = useAtom(currentClusterAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  if (options.length === 0) {
    return <RPCNotReadyAlert />
  }
  return (
    <Select value={currentCluster?.id || currentClusterId} onChange={setClusterId} options={options} />
  )
}

const SuspenseFormField: FC<{ label: string, children: ReactNode }> = ({ label, children }) => {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <div>
        <Suspense fallback={<Skeleton height="40px" />}>
          {children}
        </Suspense>
      </div>
    </FormControl>
  )
}

const WorkerSelect = () => {
  const [currentWorkerId, setCurrentWorkerId] = useAtom(currentWorkerIdAtom)
  const availableWorkerList = useAtomValue(availableWorkerListAtom)
  const options = useMemo(() => availableWorkerList.map(
    i => ({
      value: i,
      // label: i.substring(0, 12) + '...' + i.substring(i.length - 12),
      label: i,
    })
  ), [availableWorkerList])
  
  if (options.length === 0) {
    return <RPCNotReadyAlert />
  }
  return (
    <div tw="flex flex-col gap-1 max-h-[40vh] overflow-y-scroll pr-4">
      {options.map((i, idx) => (
        <div key={idx} tw="flex flex-row justify-between">
          <Tooltip label={i.value} placement="top">
            <Code>{i.label}</Code>
          </Tooltip>
          {i.value === currentWorkerId ? (
            <Button size="xs" isDisabled>Selcted</Button>
          ) : (
            <Button size="xs" onClick={() => setCurrentWorkerId(i.value)}>Select</Button>
          )}
        </div>
      ))}
    </div>
  )
}

const PruntimeEndpointSelect = () => {
  const [currentPruntime, setCurrentPruntime] = useAtom(pruntimeURLAtom)
  const availableWorkerList = useAtomValue(availablePruntimeListAtom)
  const [isCustomPruntime, setIsCustomPruntime] = useAtom(preferCustomPruntime)
  const options = useMemo(
    () => availableWorkerList.map(i => ({ value: i, label: i })),
    [availableWorkerList]
  )
  if (options.length === 0 || isCustomPruntime) {
    return (
      <div tw="flex flex-col items-start gap-0.5">
        <InputGroup>
          <Input
            onChange={i => setCurrentPruntime(i.target.value)}
            value={currentPruntime}
          />
        </InputGroup>
        <Button disabled={options.length === 0} size="xs" variant="link" onClick={() => setIsCustomPruntime(false)}>
          Choose from Public Pruntime List
        </Button>
      </div>
    )
  }
  return (
    <ButtonGroup w="full">
      <Select value={currentPruntime} onChange={setCurrentPruntime} options={options} />
      <Button onClick={() => setIsCustomPruntime(true)}>Custom</Button>
    </ButtonGroup>
  )
}

//
//
//


export default function ConnectionDetailModal() {
  const [visible, setVisible] = useAtom(connectionDetailModalVisibleAtom)
  const machine = useAtomValue(websocketConnectionMachineAtom)
  
  return (
    <Modal isOpen={visible} onClose={() => setVisible(false)}>
      <ModalOverlay />
      <ModalContent tw="xl:min-w-[720px]">
        <ModalHeader>Connection Info</ModalHeader>
        <ModalCloseButton />
          <ModalBody>
            <VStack>
              <FormControl isInvalid={machine.matches('error')}>
                <EndpointAddressInput label="RPC Endpoint" />
                <FormErrorMessage>Connect error: the RPC Endpoint is wrong.</FormErrorMessage>
              </FormControl>
              {
                !['error', 'disconnected'].some(machine.matches) ? 
                 <>
                   <SuspenseFormField label="Cluster">
                     <ClusterIdSelect />
                   </SuspenseFormField>
                   <SuspenseFormField label="Worker">
                     <WorkerSelect />
                   </SuspenseFormField>
                   <SuspenseFormField label="PRuntime">
                     <PruntimeEndpointSelect />
                   </SuspenseFormField>
                 </> : null
              }
            </VStack>
          </ModalBody>
        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}
