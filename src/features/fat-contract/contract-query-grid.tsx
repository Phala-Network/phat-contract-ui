import React from 'react'
import tw from 'twin.macro'
import { Box, SimpleGrid } from '@chakra-ui/react'
import { atom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
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

/*

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
      ? api.rpc.chain.getFinalizedHead()
      : api.rpc.chain.getHeader()
  );
  let chainHeight = head.number.toNumber();
  await checkUntil(
      async() => (await prpc.getInfo({})).blocknum > chainHeight,
      timeout,
  );
}
*/

const ContractQueryGrid = () => {
  const messages = useAtomValue(messagesAtom)
  // const contractInstance = useAtomValue(currentContractInstanceAtom)
  // const account = useAtomValue(lastSelectedAccountAtom)
  if (!messages.length) {
    return null
  }
  // console.log(messages, contractInstance)
  // const txMethods = R.fromPairs(R.map(
  //   i => [i.meta.identifier, i.meta.method],
  //   R.values(contractInstance?.tx || {})
  // ))
  // const queryMethods = R.fromPairs(R.map(
  //   i => [i.meta.identifier, i.meta.method],
  //   R.values(contractInstance?.query || {})
  // ))
  return (
    <SimpleGrid columns={3} spacing={8}>
      {messages.map((message, i) => (
        <Box key={i} borderWidth="1px" overflow="hidden" my="2" p="4" bg="gray.800">
          <div tw="flex flex-row items-center justify-between">
            <div tw="flex flex-row items-center">
              <h4 tw="mr-2 font-mono text-lg">{message.label}</h4>
              {message.mutates ? (
                <span tw="font-pw font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase">tx</span>
              ) : (
                <span tw="font-pw font-semibold text-phalaDark text-xs py-0.5 px-2 rounded bg-black uppercase">query</span>
              )}
            </div>
            <button
              onClick={async () => {
                // const methodName = methodNames[message.label]
                // console.log('run method', message, methodName, contractInstance, account)
                // if (methodName) {
                  // const { signer } = await web3FromSource(account?.meta.source)

                  // query
                  // const cert = await Phala.signCertificate({signer, account, api: contractInstance.api});
                  // const r2 = await contractInstance?.query[methodName](cert, { value: 0, gasLimit: -1 });
                  // console.log(r2)
                  // console.log(r2?.output?.toHuman())

                  // tx
                  // contractInstance?.query[methodName](cert, { value: 0, gasLimit: -1 }),
                  // const r1 = await signAndSend(
                  //   contractInstance?.tx[methodName]({}),
                  //   account?.address,
                  //   signer
                  // )
                  // console.log(r1)
                  // const prpc = await Phala.createPruntimeApi(pruntimeURL)
                  // await blockBarrier(contractInstance.api, prpc);
                // }
                // const r1 = await contractInstance?.tx[message.label]({})
                // console.log('r1', r1)
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
  )
}

export default ContractQueryGrid