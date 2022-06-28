import React, { FC, Suspense, useState } from 'react'
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
} from '@chakra-ui/react'
import { atom, useAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AiFillPlayCircle } from 'react-icons/ai'

import Code from '@/features/ui/code'
import { useRunner, currentMethodAtom, messagesAtom } from '@/features/chain/atoms'

export const argsFormModalVisibleAtom = atom(false)

const MethodTypeLabel = tw.span`font-pw font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const ExecuteButton: FC<{
  inputs: Record<string, unknown>,
  onFinish?: () => void
}> = ({ inputs, onFinish }) => {
  const [isRunning, runner] = useRunner()
  return (
    <Button
      colorScheme="phalaDark"
      isLoading={isRunning}
      onClick={async () =>{
        await runner(inputs)
        onFinish && onFinish()
        // console.log('inputs: ', inputs)
      }}
    >
      Run
    </Button>
  )
}

const SimpleArgsFormModal = () => {
  const [visible, setVisible] = useAtom(argsFormModalVisibleAtom)
  const [inputs, setInputs] = useState({})
  const currentMethod = useAtomValue(currentMethodAtom)
  if (!currentMethod) {
    return null
  }
  return (
    <Modal isOpen={visible} onClose={() => setVisible(false)}>
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
                  <code tw="ml-2 text-xs text-gray-500">{JSON.stringify(arg.type.displayName)}</code>
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
                      } catch (err) {
                        // console.log(`[${arg.label}] parse error:`, err)
                        setInputs({...inputs, [arg.label]: value})
                      }
                    }} />
                  </InputGroup>
                </div>
              </FormControl>
            ))}
          </Box>
        </ModalBody>
        <ModalFooter>
          <ButtonGroup>
            <Suspense fallback={<Button colorScheme="phalaDark" isDisabled>Run</Button>}>
              <ExecuteButton inputs={inputs} onFinish={() => setVisible(false)} />
            </Suspense>
            <Button onClick={() => setVisible(false)}>Close</Button>
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
          <Box key={i} borderWidth="1px" overflow="hidden" my="2" p="4" bg="gray.800">
            <div tw="flex flex-row items-center justify-between">
              <div tw="flex flex-row items-center">
                <h4 tw="mr-2 font-mono text-lg">{message.label}</h4>
                {message.mutates ? (
                  <MethodTypeLabel>tx</MethodTypeLabel>
                ) : (
                  <MethodTypeLabel>query</MethodTypeLabel>
                )}
              </div>
              <button
                onClick={() => {
                  setCurrentMethod(message)
                  setArgsFormModalVisible(true)
                }}
              >
                <AiFillPlayCircle tw="h-8 w-8 text-phala-500" />
              </button>
            </div>
            <div tw="my-1">
              <Code>{message.selector}</Code>
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