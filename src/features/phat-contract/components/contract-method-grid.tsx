import type { FC } from 'react'

import React, { Suspense, useState } from 'react'
import * as R from 'ramda'
import tw from 'twin.macro'
import {
  Box,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  ButtonGroup,
  CircularProgress,
  Spinner,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
} from '@chakra-ui/react'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TiMediaPlay, TiFlash } from 'react-icons/ti'

import Code from '@/components/code'
import useContractExecutor, { estimateGasAtom, inputsAtom, ExecResult } from '../hooks/useContractExecutor'
import { currentMethodAtom, messagesAtom } from '../atoms'
import ArgumentsForm from './contract-method-arguments-form'
// import { clearAtomsCache, currentArgsFormClearValidationAtom } from '../argumentsFormAtom'
// import { useRunner, currentMethodAtom, messagesAtom } from '@/features/chain/atoms'
import { atomsWithDepositSettings } from '../atomsWithDepositSettings'


const [depositSettingsValueAtom, depositSettingsFieldAtom] = atomsWithDepositSettings(estimateGasAtom)

export const argsFormModalVisibleAtom = atom(false)

const MethodTypeLabel = tw.span`font-mono font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const ExecuteButton: FC<{
  onFinish?: () => void
}> = ({ onFinish }) => {
  const depositSettings = useAtomValue(depositSettingsValueAtom)
  const [isRunning, runner] = useContractExecutor()
  return (
    <Button
      colorScheme="phalaDark"
      isLoading={isRunning}
      onClick={async () =>{
        const result = await runner(depositSettings)
        if (result === ExecResult.Stop) {
          return
        }
        onFinish && onFinish()
        // console.log('inputs: ', inputs)
      }}
    >
      Run
    </Button>
  )
}

const InstaExecuteButton: FC<{
  methodSpec: ContractMetaMessage,
}> = ({ methodSpec }) => {
  const [isRunning, runner] = useContractExecutor()
  return (
    <button
      tw="rounded-full h-8 w-8 flex justify-center items-center bg-phalaDark-800"
      disabled={isRunning}
      onClick={() => runner({autoDeposit: true}, methodSpec)}
    >
      {isRunning ? <CircularProgress isIndeterminate size="1.5rem" color="black" /> : <TiFlash tw="h-6 w-6 text-phala-200" />}
    </button>
  )
}

const AutoDepositInputGroup = () => {
  const [value, update] = useAtom(depositSettingsFieldAtom)
  if (value.autoDeposit) {
    return (
      <>
        <Checkbox isChecked onChange={() => update({ autoDeposit: false })}>
          Auto-deposit
        </Checkbox>
        <dl tw='text-xs flex flex-col gap-1 mt-2'>
          <div tw='flex flex-row'>
            <dt tw='text-gray-500 min-w-[6.5rem]'>Gas</dt>
            <dd>{value.gasLimit || ''}</dd>
          </div>
          <div tw='flex flex-row'>
            <dt tw='text-gray-500 min-w-[6.5rem]'>Storage Deposit</dt>
            <dd>{value.storageDepositLimit || ''}</dd>
          </div>
        </dl>
      </>
    )
  }
  return (
    <>
      <Checkbox onChange={() => update({ autoDeposit: true })}>
        Auto-deposit
      </Checkbox>
      <div tw='flex flex-col gap-2 mt-2'>
        <FormControl>
          <FormLabel tw='text-xs'>
            Gas Limit
          </FormLabel>
          <Input
            size="sm"
            value={(value.gasLimit === null || value.gasLimit === undefined) ? '' : `${value.gasLimit}`}
            onChange={({ target: { value } }) => {
              update({ gasLimit: value === '' ? null : Number(value) })
            }}
          />
        </FormControl>
        <FormControl>
          <FormLabel tw='text-xs'>
            Storage Deposit Limit
          </FormLabel>
          <Input
            size="sm"
            value={(value.storageDepositLimit === null || value.storageDepositLimit === undefined) ? '' : `${value.storageDepositLimit}`}
            onChange={({ target: { value } }) => {
              update({ storageDepositLimit: value === '' ? null : Number(value) })
            }}
          />
        </FormControl>
      </div>
    </>
  )
}

const DepositSettingsField = () => {
  return (
    <div>
      <FormControl mt={4}>
        <FormLabel>
          Gas Limit
        </FormLabel>
        <div tw="px-4 pb-4">
          <Suspense fallback={
            <Checkbox isReadOnly isChecked>
              <span tw='flex flex-row gap-2 items-center'>
                <span tw='text-gray-400'>Auto-deposit</span>
                <Spinner size="xs" />
              </span>
            </Checkbox>
          }>
            <AutoDepositInputGroup />
          </Suspense>
        </div>
      </FormControl>
    </div>
  )
}

const SimpleArgsFormModal = () => {
  const [visible, setVisible] = useAtom(argsFormModalVisibleAtom)
  const setPreviewInputs = useSetAtom(inputsAtom)
  const currentMethod = useAtomValue(currentMethodAtom)
  // const currentArgsFormClearValidation = useSetAtom(currentArgsFormClearValidationAtom)

  const hideModal = () => {
    setVisible(false)
    // currentArgsFormClearValidation()
  }

  if (!currentMethod) {
    return null
  }

  return (
    <Modal size="full" scrollBehavior="inside" isOpen={visible} onClose={hideModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <h4 tw="mr-2 font-mono text-lg">{currentMethod.label}</h4>
          {currentMethod.mutates ? (
            <MethodTypeLabel>tx</MethodTypeLabel>
          ) : (
            <MethodTypeLabel>query</MethodTypeLabel>
          )}
          <ModalCloseButton tw="mt-2" />
        </ModalHeader>
        <ModalBody>
          <ArgumentsForm />
          {currentMethod.mutates ? <DepositSettingsField /> : null}
        </ModalBody>
        <ModalFooter>
          <ButtonGroup>
            <Suspense fallback={<Button colorScheme="phalaDark" isDisabled>Run</Button>}>
              <ExecuteButton onFinish={hideModal}/>
            </Suspense>
            <Button onClick={hideModal}>
              Close
            </Button>
          </ButtonGroup>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const ContractMethodGrid = () => {
  const messages = useAtomValue(messagesAtom)
  const setCurrentMethod = useUpdateAtom(currentMethodAtom)
  const setArgsFormModalVisible = useUpdateAtom(argsFormModalVisibleAtom)
  if (!messages.length) {
    return null
  }
  return (
    <>
      <SimpleGrid columns={3} spacing={8}>
        {messages.map((message, i) => (
          <Box key={i} borderWidth="1px" overflow="hidden" my="2" p="4" bg="gray.800" display="flex" flexDir="column" gap="2">
            <h4 tw="mr-2 font-mono text-base break-all">{message.label}</h4>
            <div tw="flex flex-row items-center justify-between">
              <div tw="flex flex-row gap-1 items-center">
                {message.mutates ? (
                  <MethodTypeLabel>tx</MethodTypeLabel>
                ) : (
                  <MethodTypeLabel>query</MethodTypeLabel>
                )}
                <Code>{message.selector}</Code>
              </div>
              <div>
                {message.args.length > 0 ? (
                  <button
                    tw="rounded-full h-8 w-8 flex justify-center items-center bg-black"
                    onClick={() => {
                      setCurrentMethod(message)
                      setArgsFormModalVisible(true)
                    }}
                  >
                    <TiMediaPlay tw="h-6 w-6 text-phala-500" />
                  </button>
                ) : (
                  <InstaExecuteButton methodSpec={message} />
                )}
              </div>
            </div>
            <ReactMarkdown tw="text-gray-200" remarkPlugins={[remarkGfm]}>
              {message.docs.join("")}
            </ReactMarkdown>
          </Box>
        ))}
      </SimpleGrid>
      <SimpleArgsFormModal />
    </>
  )
}

export default ContractMethodGrid
