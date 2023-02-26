import React, { FC, Suspense, useState } from 'react'
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
} from '@chakra-ui/react'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TiMediaPlay, TiFlash } from 'react-icons/ti'

import Code from '@/components/code'
import useContractExecutor, { ExecResult } from '../hooks/useContractExecutor'
import { currentMethodAtom, messagesAtom } from '../atoms'
import ArgumentsForm from './contract-method-arguments-form'
import { clearAtomsCache, currentArgsFormClearValidationAtom } from '../argumentsFormAtom'
// import { useRunner, currentMethodAtom, messagesAtom } from '@/features/chain/atoms'

export const argsFormModalVisibleAtom = atom(false)

const MethodTypeLabel = tw.span`font-mono font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const ExecuteButton: FC<{
  onFinish?: () => void
}> = ({ onFinish }) => {
  const [isRunning, runner] = useContractExecutor()
  return (
    <Button
      colorScheme="phalaDark"
      isLoading={isRunning}
      onClick={async () =>{
        const result = await runner()
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
      onClick={() => runner(methodSpec)}
    >
      {isRunning ? <CircularProgress isIndeterminate size="1.5rem" color="black" /> : <TiFlash tw="h-6 w-6 text-phala-200" />}
    </button>
  )
}

const SimpleArgsFormModal = () => {
  const [visible, setVisible] = useAtom(argsFormModalVisibleAtom)
  const currentMethod = useAtomValue(currentMethodAtom)
  const currentArgsFormClearValidation = useSetAtom(currentArgsFormClearValidationAtom)

  const hideModal = () => {
    setVisible(false)
    currentArgsFormClearValidation()
    clearAtomsCache()
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