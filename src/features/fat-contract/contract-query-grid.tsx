import React, { FC, Suspense, useCallback, useState } from 'react'
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
  FormErrorMessage,
  InputRightElement,
  Button,
  ButtonGroup,
} from '@chakra-ui/react'
import { atom, PrimitiveAtom, useAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AiFillPlayCircle } from 'react-icons/ai'
import { ContractPromise } from '@polkadot/api-contract'
import { web3FromSource } from '@polkadot/extension-dapp'
import * as R from 'ramda'

import { rpcApiInstanceAtom } from '@/atoms/foundation'
import Code from '@/features/ui/code'
import { lastSelectedAccountAtom } from '@/features/account/atoms'
import * as Phala from '../../sdk'
import { signAndSend } from '../instantiate/hooks/use-upload-code-and-instantiate'

import { currentContractAtom } from './atoms'


const messagesAtom = atom(get => {
  const contract = get(currentContractAtom)
  if (!contract) {
    return []
  }
  return contract.metadata.V3.spec.messages || []
})

const pruntimeURL = 'https://poc5.phala.network/tee-api-1'

const currentContractInstanceAtom = atom(async (get) => {
  const api = get(rpcApiInstanceAtom)
  const contract = get(currentContractAtom)
  if (!api || !contract) {
    return null
  }
  const contractId = contract?.contractId
  // https://poc5.phala.network/tee-api-1
  // const prpc = Phala.createPruntimeApi(pruntimeURL);
  // const worker = await getWorkerPubkey(api);
  // const connectedWorker = hex((await prpc.getInfo({})).publicKey);
  const newApi = await api.clone().isReady;
  const contractPromise = new ContractPromise(
    await Phala.create({api: newApi, baseURL: pruntimeURL, contractId}),
    contract.metadata,
    contractId
  );
  return contractPromise
});

async function sleep(t: number) {
  await new Promise(resolve => {
      setTimeout(resolve, t);
  });
}

async function checkUntil<T>(async_fn: () => Promise<T>, timeout: number) {
    const t0 = new Date().getTime();
    while (true) {
        if (await async_fn()) {
            return;
        }
        const t = new Date().getTime();
        if (t - t0 >= timeout) {
            throw new Error('timeout');
        }
        await sleep(100);
    }
}

async function blockBarrier(api: unknown, prpc: unknown, finalized=false, timeout=4*6000) {
  const head = await (finalized
      // @ts-ignore
      ? api.rpc.chain.getFinalizedHead()
      // @ts-ignore
      : api.rpc.chain.getHeader()
  );
  let chainHeight = head.number.toNumber();
  await checkUntil(
      // @ts-ignore
      async() => (await prpc.getInfo({})).blocknum > chainHeight,
      timeout,
  );
}

const currentMethodAtom = atom<ContractMetaMessage | null>(null)

const argsFormModalVisibleAtom = atom(false)

const MethodTypeLabel = tw.span`font-pw font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase`

const useRunner = (): [boolean, (inputs: Record<string, unknown>) => void] => {
  const methodSpec = useAtomValue(currentMethodAtom)
  const contractInstance = useAtomValue(currentContractInstanceAtom)
  const account = useAtomValue(lastSelectedAccountAtom)
  const [isLoading, setIsLoading] = useState(false)
  const fn = useCallback(async (inputs: Record<string, unknown>) => {
    setIsLoading(true)
    try {
      if (!contractInstance || !account || !methodSpec) {
        console.debug('contractInstance or account is null')
        return
      }
      console.log('methodSpec', methodSpec)

      const queryMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.query || {})
      ))
      const txMethods = R.fromPairs(R.map(
        i => [i.meta.identifier, i.meta.method],
        R.values(contractInstance.tx || {})
      ))
      // console.log('queryMethods', queryMethods)
      // console.log('txMethods', txMethods)

      if (!queryMethods[methodSpec.label] && !txMethods[methodSpec.label]) {
        console.debug('method not found', methodSpec.label)
        return
      }
      const args = R.map(
        i => inputs[i.label],
        methodSpec.args
      )
      console.log('args built: ', args)

      const { signer } = await web3FromSource(account.meta.source)

      // tx
      if (methodSpec.mutates) {
        const r1 = await signAndSend(
          contractInstance.tx[txMethods[methodSpec.label]]({}, ...args),
          account.address,
          signer
        )
        console.log(r1)
        const prpc = await Phala.createPruntimeApi(pruntimeURL)
        await blockBarrier(contractInstance.api, prpc)
      }
      // query
      else {
        // @ts-ignore
        const cert = await Phala.signCertificate({signer, account, api: contractInstance.api});
        // @ts-ignore
        const r2 = await contractInstance?.query[queryMethods[methodSpec.label]](cert, { value: 0, gasLimit: -1 }, ...args);
        console.log(r2)
        console.log(r2?.output?.toHuman())
        // if (methodSpec.label === 'attest') {
        //   console.log(
        //       'Easy attestation:',
        //       r2.result.isOk ? r2.output.toHuman() : r2.result.toHuman()
        //   );
        //   console.log(contractInstance.registry.createType('GistQuote', r2.output.asOk.data.toHex()).toHuman())
        // }
      }
      console.log('executed.')
    } finally {
      setIsLoading(false)
    }
  }, [contractInstance, account, methodSpec])
  return [isLoading, fn]
}

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
            <Suspense fallback={<div>Loading...</div>}>
              <ExecuteButton inputs={inputs} onFinish={() => setVisible(false)} />
            </Suspense>
            <Button onClick={() => setVisible(false)}>Close</Button>
          </ButtonGroup>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const ContractQueryGrid = () => {
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

export default ContractQueryGrid