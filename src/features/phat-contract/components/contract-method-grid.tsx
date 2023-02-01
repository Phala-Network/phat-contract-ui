import type { FC } from 'react'

import React, { Suspense, useState } from 'react'
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
  Input,
  InputGroup,
  FormControl,
  FormLabel,
  Button,
  ButtonGroup,
  CircularProgress,
  Spinner,
  Checkbox,
} from '@chakra-ui/react'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TiMediaPlay, TiFlash } from 'react-icons/ti'

import Code from '@/components/code'
import useContractExecutor, { estimateGasAtom, inputsAtom } from '../hooks/useContractExecutor'
import { currentMethodAtom, messagesAtom } from '../atoms'
import { atomsWithDepositSettings } from '../atomsWithDepositSettings'


const [depositSettingsValueAtom, depositSettingsFieldAtom] = atomsWithDepositSettings(estimateGasAtom)

export const argsFormModalVisibleAtom = atom(false)

const MethodTypeLabel = tw.span`font-mono font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const ExecuteButton: FC<{
  inputs: Record<string, unknown>,
  onFinish?: () => void
}> = ({ inputs, onFinish }) => {
  const depositSettings = useAtomValue(depositSettingsValueAtom)
  const [isRunning, runner] = useContractExecutor()
  return (
    <Button
      colorScheme="phalaDark"
      isLoading={isRunning}
      onClick={async () =>{
        await runner(inputs, depositSettings)
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
      onClick={() => runner({}, {autoDeposit: true}, methodSpec)}
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
      <FormControl>
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
  const [inputs, setInputs] = useState({})
  const currentMethod = useAtomValue(currentMethodAtom)
  if (!currentMethod) {
    return null
  }
  return (
    <Modal isOpen={visible} onClose={() => {
      setVisible(false)
      setInputs({})
    }}>
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
          <Box>
            {currentMethod.args.map((arg, idx) => (
              <FormControl key={idx}>
                <FormLabel>
                  {arg.label}
                  <code tw="ml-2 text-xs text-gray-500 font-mono">{arg.type.displayName.join('::')}</code>
                </FormLabel>
                <div tw="px-4 pb-4">
                  <InputGroup>
                    <Input onChange={(evt) => {
                      const value = evt.target.value
                      // console.log(`[${arg.label}] raw input`, value)
                      try {
                        // console.log(`For parsing: {"value": ${value}}`)
                        let loaded = JSON.parse(`{"value": ${value}}`)
                        if (arg.type.type === 6) {
                          loaded = `${loaded.value}`
                        }
                        setInputs({...inputs, [arg.label]: loaded.value})
                        setPreviewInputs({...inputs, [arg.label]: loaded.value})
                      } catch (err) {
                        // console.log(`[${arg.label}] parse error:`, err)
                        setInputs({...inputs, [arg.label]: value})
                        setPreviewInputs({...inputs, [arg.label]: value})
                      }
                    }} />
                  </InputGroup>
                </div>
              </FormControl>
            ))}
          </Box>
          {currentMethod.mutates ? <DepositSettingsField /> : null}
        </ModalBody>
        <ModalFooter>
          <ButtonGroup>
            <Suspense fallback={<Button colorScheme="phalaDark" isDisabled>Run</Button>}>
              <ExecuteButton
                inputs={inputs}
                onFinish={() => {
                  setVisible(false)
                  setInputs({})
                }}
              />
            </Suspense>
            <Button
              onClick={() => {
                setVisible(false)
                setInputs({})
              }}
            >
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
