import React, { type ReactNode, type FC, Suspense, useCallback, useMemo, useState, useEffect } from 'react'
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
import { Abi } from '@polkadot/api-contract'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TiMediaPlay, TiFlash, TiDocument } from 'react-icons/ti'
import { BiChevronRight, BiChevronDown } from 'react-icons/bi'

import Code from '@/components/code'
import useContractExecutor, { estimateGasAtom, ExecResult } from '../hooks/useContractExecutor'
import { argumentFormAtomsWithAbiAndLabel, type NormalizedFormAtom } from '../argumentsFormAtom'
import { currentMethodAtom, phatRegistryAtom, useContractInfoAtom, useRequestSign } from '../atoms'
import ArgumentsForm from './contract-method-arguments-form'
import { atomsWithDepositSettings } from '../atomsWithDepositSettings'
import { apiPromiseAtom } from '@/features/parachain/atoms'
import { signerAtom } from '@/features/identity/atoms'


const [depositSettingsValueAtom, depositSettingsFieldAtom] = atomsWithDepositSettings(estimateGasAtom)

export const argsFormModalVisibleAtom = atom(false)

const currentContractIdAtom = atom<string | null>(null)

const MethodTypeLabel = tw.span`font-mono font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const ExecuteButton: FC<{
  onFinish?: () => void
  formDataAtom: NormalizedFormAtom
}> = ({ onFinish, formDataAtom }) => {
  const formData = useAtomValue(formDataAtom)
  const args = useMemo(() => R.fromPairs(R.map(
    ([name, id]) => [name, formData.fieldDataSet[id].value],
    R.toPairs(formData.formData)
  )), [formData])

  const contractId = useAtomValue(currentContractIdAtom)
  const contractInfoAtom = useContractInfoAtom(contractId!)
  const dispatch = useSetAtom(contractInfoAtom)
  const currentMethod = useAtomValue(currentMethodAtom)
  const [isRunning, setIsRunning] = useState(false)
  const { getCert } = useRequestSign()
  if (!currentMethod) {
    return null
  }
  return (
    <Button
      colorScheme="phalaDark"
      isLoading={isRunning}
      onClick={async () =>{
        setIsRunning(true)
        try {
          const cert = await getCert()
          if (cert) {
            await dispatch({ type: 'exec', method: currentMethod, cert, args })
            onFinish && onFinish()
          }
        } finally {
          setIsRunning(false)
        }
        // const result = await runner(depositSettings)
        // if (result === ExecResult.Stop) {
        //   return
        // }
      }}
    >
      Run
    </Button>
  )
}

const InstaExecuteButton: FC<{
  methodSpec: ContractMetaMessage,
  dispatch: (...args: any[]) => unknown
}> = ({ methodSpec, dispatch }) => {
  const { getCert } = useRequestSign()
  const [isRunning, setIsRunning] = useState(false)
  return (
    <button
      tw="rounded-full h-8 w-8 flex justify-center items-center bg-phalaDark-800"
      disabled={isRunning}
      onClick={async () => {
        setIsRunning(true)
        try {
          const cert = await getCert()
          if (cert) {
            // runner({autoDeposit: true}, methodSpec)
            await dispatch({ type: 'exec', method: methodSpec, cert })
          }
        } finally {
          setIsRunning(false)
        }
      }}
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

const SimpleArgsFormModal = ({ metadata }: { metadata?: ContractMetadata }) => {
  const [visible, setVisible] = useAtom(argsFormModalVisibleAtom)
  const currentMethod = useAtomValue(currentMethodAtom)
  const hideModal = useCallback(() => setVisible(false), [setVisible])

  const [currentArgsFormAtomInAtom, currentMessageArgumentAtomListAtom] = useMemo(() => argumentFormAtomsWithAbiAndLabel(
    atom(new Abi(metadata || {})),
    atom(currentMethod?.label || ''),
    'message'
  ), [metadata, currentMethod])
  const formDataAtom = useAtomValue(currentArgsFormAtomInAtom)

  if (!currentMethod || !metadata) {
    return null
  }

  return (
    <Modal scrollBehavior="inside" isOpen={visible} onClose={hideModal}>
      <ModalOverlay />
      <ModalContent minWidth="75vw" maxWidth="780px">
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
          {currentMethod.docs.length ? (
            <details tw="mb-4">
              <summary tw="list-none">
                <div tw="flex flex-row gap-1 items-center cursor-pointer hover:underline mb-1"><TiDocument tw="h-3.5 w-3.5"/>Full Docs</div>
              </summary>
              <div tw="px-4 border border-solid border-gray-600">
                <ReactMarkdown tw="text-gray-200 prose prose-h1:text-lg prose-h1:font-semibold prose-invert" remarkPlugins={[remarkGfm]}>
                  {currentMethod.docs.filter(i => R.trim(i)[0] !== '@').join("\n")}
                </ReactMarkdown>
              </div>
            </details>
          ) : null}
          <ArgumentsForm theAtom={currentMessageArgumentAtomListAtom} />
          {/* {currentMethod.mutates ? <DepositSettingsField /> : null} */}
        </ModalBody>
        <ModalFooter>
          <ButtonGroup>
            <Suspense fallback={<Button colorScheme="phalaDark" isDisabled>Run</Button>}>
              <ExecuteButton onFinish={hideModal} formDataAtom={formDataAtom} />
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

const currentDocsAtom = atom<[string, string[]]>(['', []])

function FunctionDocModal() {
  const [[title, docs], setDocs] = useAtom(currentDocsAtom)
  const visible = useMemo(() => docs.length > 0, [docs])
  const hideModal = useCallback(() => setDocs(['', []]), [setDocs])
  return (
    <Modal scrollBehavior="inside" isOpen={visible} onClose={hideModal}>
      <ModalOverlay />
      <ModalContent minWidth="45vw" maxWidth="580px">
        <ModalHeader>
          <h4 tw="mr-2 font-mono text-lg">{title}</h4>
          <ModalCloseButton tw="mt-2" />
        </ModalHeader>
        <ModalBody>
          <ReactMarkdown tw="text-gray-200 prose prose-h1:text-lg prose-h1:font-semibold prose-invert" remarkPlugins={[remarkGfm]}>
            {docs.filter(i => R.trim(i)[0] !== '@').join("\n")}
          </ReactMarkdown>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function getCategoryFromDocs(docs: string[], defaults: string) {
  const matched = R.find(i => i.indexOf('@category') !== -1, docs)
  if (matched) {
    return R.trim(matched).split(' ').slice(1).join(' ')
  }
  return defaults
}

function Details({ label, children }: { label: string, children: ReactNode }) {
  const [openned, setOpenned] = useState(false)
  return (
    <details
      open={openned}
      onClick={(ev) => {
        ev.preventDefault()
      }}
    >
      <summary tw="list-none">
        <h3
          tw="text-xl border-b border-solid border-gray-600 mb-4 leading-8 py-2 select-none cursor-pointer flex flex-row justify-between"
          onClick={() => setOpenned(i => !i)}
        >
          {label}
          {openned ? (<BiChevronDown tw="w-6 h-6" />) : (<BiChevronRight tw="w-6 h-6" />)}
        </h3>
      </summary>
      {children}
    </details>
  )
}

export default function ContractMethodGrid({ contractId }: { contractId: string }) {
  // hacks that before migrate to jotai v2
  const _registry = useAtomValue(phatRegistryAtom)
  const _api = useAtomValue(apiPromiseAtom)
  const _signer = useAtomValue(signerAtom)

  const contractInfoAtom = useContractInfoAtom(contractId)
  const [contractInfo, dispatch] = useAtom(contractInfoAtom)

  const setCurrentContractId = useSetAtom(currentContractIdAtom)
  useEffect(() => {
    setCurrentContractId(contractId)
  }, [contractId, setCurrentContractId])

  const groupedMessages = useMemo(
    () => {
      const messages = (function() {
        if (contractInfo && contractInfo.metadata) {
          if (contractInfo.metadata.V3) {
            return contractInfo.metadata.V3.spec.messages || []
          } else {
            return contractInfo.metadata.spec.messages || []
          }
        }
        return []
      })();
      const grouped = R.groupBy(msg => getCategoryFromDocs(msg.docs, 'Ungrouped'), messages)
      return R.toPairs(grouped)
    },
    [contractInfo]
  )

  // const groupedMessages = useAtomValue(groupedMessagesAtom)
  const setCurrentMethod = useUpdateAtom(currentMethodAtom)
  const setArgsFormModalVisible = useUpdateAtom(argsFormModalVisibleAtom)
  const setDocs = useUpdateAtom(currentDocsAtom)
  if (!groupedMessages.length) {
    return null
  }
  return (
    <>
      {groupedMessages.length === 1 ? (
        <SimpleGrid columns={3} spacing={8}>
          {groupedMessages[0][1].map((message, i) => (
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
                      <TiMediaPlay tw="h-6 w-6 ml-0.5 -mt-0.5 text-phala-500" />
                    </button>
                  ) : (
                    <InstaExecuteButton methodSpec={message} dispatch={dispatch} />
                  )}
                </div>
              </div>
              {message.docs.length > 0 ? (
                <div tw="text-gray-200">
                  {message.docs[0]}
                </div>
              ) : null}
              <div>
                {message.docs.length > 1 ? (
                  <Button
                    variant="link"
                    tw="flex flex-row gap-0.5 items-center text-sm text-gray-400"
                    onClick={() => setDocs([message.label, message.docs])}
                  >
                    <TiDocument tw="h-3.5 w-3.5"/>Full Docs
                  </Button>
                ) : null}
              </div>
            </Box>
          ))}
        </SimpleGrid>
      ) : (
        groupedMessages.map(([label, messages]) => (
          <Details key={label} label={label}>
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
                          <TiMediaPlay tw="h-6 w-6 ml-0.5 -mt-0.5 text-phala-500" />
                        </button>
                      ) : (
                        <InstaExecuteButton methodSpec={message} dispatch={dispatch} />
                      )}
                    </div>
                  </div>
                  {message.docs.length > 0 ? (
                    <div tw="text-gray-200">
                      {message.docs[0]}
                    </div>
                  ) : null}
                  <div>
                    {message.docs.length > 1 ? (
                      <Button
                        variant="link"
                        tw="flex flex-row gap-0.5 items-center text-sm text-gray-400"
                        onClick={() => setDocs([message.label, message.docs])}
                      >
                        <TiDocument tw="h-3.5 w-3.5"/>Full Docs
                      </Button>
                    ) : null}
                  </div>
                </Box>
              ))}
            </SimpleGrid>
          </Details>
        ))
      )}
      <SimpleArgsFormModal metadata={contractInfo?.metadata} />
      <FunctionDocModal />
    </>
  )
}

