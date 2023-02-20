import React, { FC, Suspense, useState } from 'react'
import { camelize } from 'humps'
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
  FormErrorMessage,
} from '@chakra-ui/react'
import { atom, useAtom } from 'jotai'
import { useUpdateAtom, useAtomValue, RESET } from 'jotai/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TiMediaPlay, TiFlash } from 'react-icons/ti'

import Code from '@/components/code'
import useContractExecutor, { ExecResult } from '../hooks/useContractExecutor'
import { currentAbiAtom, currentArgsAtom, currentArgsErrorsAtom, currentMethodAtom, messagesAtom } from '../atoms'
import { singleInputValidator } from '@/functions/argumentsValidator'
import { TypeDef } from '@polkadot/types/types'
// import { useRunner, currentMethodAtom, messagesAtom } from '@/features/chain/atoms'

export const argsFormModalVisibleAtom = atom(false)

// In order to make the type name easier to understand,
// some name conversions need to done.
const formatTypeName = (typeName: string) => {
  // Text => String
  // Bytes => Vec<u8>, bytes can receive string format, only display to Vec<u8>
  return typeName
    .replace(/(?<![0-9a-zA-Z])Text(?![0-9a-zA-Z])/g, 'String')
    .replace(/(?<![0-9a-zA-Z])Bytes(?![0-9a-zA-Z])/g, 'Vec<u8>')
}

const MethodTypeLabel = tw.span`font-mono font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const ExecuteButton: FC<{
  inputs: Record<string, unknown>,
  onFinish?: () => void
}> = ({ inputs, onFinish }) => {
  const [isRunning, runner] = useContractExecutor()
  return (
    <Button
      colorScheme="phalaDark"
      isLoading={isRunning}
      onClick={async () =>{
        const result = await runner(inputs)
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
      onClick={() => runner({}, methodSpec)}
    >
      {isRunning ? <CircularProgress isIndeterminate size="1.5rem" color="black" /> : <TiFlash tw="h-6 w-6 text-phala-200" />}
    </button>
  )
}

const SimpleArgsFormModal = () => {
  const [visible, setVisible] = useAtom(argsFormModalVisibleAtom)
  const [inputs, setInputs] = useState({})
  const currentMethod = useAtomValue(currentMethodAtom)
  const [currentArgsErrors, setCurrentArgsErrors] = useAtom(currentArgsErrorsAtom)
  const currentArgs = useAtomValue(currentArgsAtom)
  const currentAbi = useAtomValue(currentAbiAtom)

  if (!currentMethod) {
    return null
  }
  return (
    <Modal isOpen={visible} onClose={() => {
      setVisible(false)
      setInputs({})
      setCurrentArgsErrors(RESET)
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
            {currentMethod.args.map((arg, idx) => {
              const label = arg.label
              const argInAbi = currentArgs.find(argItem => argItem.name === camelize(label))
              const typeName = formatTypeName(argInAbi?.type?.type || arg.type.displayName.join('::'))
              return (
                <FormControl key={idx} isInvalid={Boolean(currentArgsErrors[idx]?.length)}>
                  <FormLabel>
                    {arg.label}
                    <code tw="ml-2 text-xs text-gray-500 font-mono">{typeName}</code>
                  </FormLabel>
                  <div tw="px-4 pb-4">
                    <InputGroup>
                      <Input
                        onChange={(evt) => {
                          const value = evt.target.value
                          setInputs({ ...inputs, [arg.label]: value })

                          const errors = currentArgsErrors[idx]

                          if (errors?.length) {
                            const validateInfo = singleInputValidator(currentAbi.registry, argInAbi?.type as TypeDef, value)
                            
                            if (!validateInfo.errors.length) {
                              setCurrentArgsErrors(state => {
                                const stateCopy = [...state]
                                stateCopy[idx] = []
                                return stateCopy
                              })
                            }
                          }
                        }}
                        onBlur={event => {
                          const value = event.target.value
                          const validateInfo = singleInputValidator(currentAbi.registry, argInAbi?.type as TypeDef, value)
                          
                          if (validateInfo.errors.length) {
                            setCurrentArgsErrors(state => {
                              const stateCopy = [...state]
                              stateCopy[idx] = validateInfo.errors
                              return stateCopy
                            })
                          }
                        }}
                      />
                    </InputGroup>
                    {
                      currentArgsErrors[idx]?.length
                        ? (
                          <>
                            {
                              currentArgsErrors[idx].map((error, index) => (
                                <FormErrorMessage key={index}>{error}</FormErrorMessage>
                              ))
                            }
                          </>
                        )
                        : null
                    }
                  </div>
                </FormControl>
              )
            })}
          </Box>
        </ModalBody>
        <ModalFooter>
          <ButtonGroup>
            <Suspense fallback={<Button colorScheme="phalaDark" isDisabled>Run</Button>}>
              <ExecuteButton
                inputs={inputs}
                onFinish={() => {
                  if (currentArgsErrors.length) {
                    console.log('currentArgsErrors', currentArgsErrors)
                    return
                  }
                  setVisible(false)
                  setInputs({})
                  setCurrentArgsErrors(RESET)
                }}
              />
            </Suspense>
            <Button
              onClick={() => {
                setVisible(false)
                setInputs({})
                setCurrentArgsErrors(RESET)
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