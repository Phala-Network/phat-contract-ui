import type { FC, ReactNode } from 'react'

import React, { Suspense, useMemo } from 'react'
import tw, { styled } from 'twin.macro'
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  VStack,
  Input,
  InputGroup,
  FormControl,
  FormLabel,
  FormErrorMessage,
  InputRightElement,
  Skeleton,
} from '@chakra-ui/react'
import { atom, useAtomValue, useAtom, useSetAtom } from 'jotai'

import { Select } from '@/components/inputs/select'
import ConnectButton from '@/features/parachain/components/ConnectButton'
import EndpointAddressInput from '@/features/parachain/components/EndpointAddressInput'
import {
  pruntimeURLAtom,
  currentClusterIdAtom,
  availableClusterOptionsAtom,
  currentWorkerIdAtom,
  availableWorkerListAtom,
  availablePruntimeListAtom,
  pinkLoggerEnabledAtom,
} from '@/features/phat-contract/atoms'
import useCheckPinkLogger from '@/features/phat-contract/hooks/useCheckPinkLogger'

export const connectionDetailModalVisibleAtom = atom(false)

const ClusterIdSelect = () => {
  const [clusterId, setClusterId] = useAtom(currentClusterIdAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  return (
    <Select value={clusterId} onChange={setClusterId} options={options} />
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
  const options = useMemo(() => availableWorkerList.map(i => ({ value: i, label: i.substring(0, 12) + '...' + i.substring(i.length - 12) })), [availableWorkerList])
  return (
    <Select value={currentWorkerId} onChange={setCurrentWorkerId} options={options} />
  )
}

const PruntimeEndpointSelect = () => {
  const [currentPruntime, setCurrentPruntime] = useAtom(pruntimeURLAtom)
  const availableWorkerList = useAtomValue(availablePruntimeListAtom)
  const options = useMemo(
    () => availableWorkerList.map(i => ({ value: i, label: i })),
    [availableWorkerList]
  )
  return (
    <Select value={currentPruntime} onChange={setCurrentPruntime} options={options} />
  )
}

const StartPinkLoggerButton = () => {
  const [isChecking, checkLogger] = useCheckPinkLogger()
  const isLoggerAvailable = useAtomValue(pinkLoggerEnabledAtom)
  return (
    <div tw="pt-4 w-full flex flex-row justify-between items-center">
      <span>{isLoggerAvailable ? 'TRUE' : 'FALSE'}</span>
      <Button isLoading={isChecking} onClick={checkLogger}>Check Logger</Button>
    </div>
  )
}

export default function ConnectionDetailModal() {
  const [visible, setVisible] = useAtom(connectionDetailModalVisibleAtom)
  return (
    <Modal isOpen={visible} onClose={() => setVisible(false)}>
      <ModalOverlay />
      <ModalContent tw="xl:min-w-[540px]">
        <ModalHeader>Connection Info</ModalHeader>
        <ModalCloseButton />
          <ModalBody>
            <VStack>
              <EndpointAddressInput label="RPC Endpoint" />
              <SuspenseFormField label="Cluster ID">
                <ClusterIdSelect />
              </SuspenseFormField>
              <SuspenseFormField label="Worker">
                <WorkerSelect />
              </SuspenseFormField>
              <SuspenseFormField label="PRuntime">
                <PruntimeEndpointSelect />
              </SuspenseFormField>
              <Suspense fallback={<div />}>
                <StartPinkLoggerButton />
              </Suspense>
            </VStack>
          </ModalBody>
        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}
