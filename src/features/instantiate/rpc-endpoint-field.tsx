import { useState } from 'react'
import tw from 'twin.macro'
import { useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import { FormControl, FormLabel, FormErrorMessage, InputGroup, Input, InputRightElement, Button } from '@chakra-ui/react'

import { rpcEndpointAtom, rpcApiStatusAtom, rpcEndpointErrorAtom } from '@/features/chain/atoms'

export default function RpcEndpointField() {
  const [endpoint, setEndpoint] = useAtom(rpcEndpointAtom)
  const [input, setInput] = useState(endpoint)
  const [validateError, setValidateError] = useState('')
  const [error, setError] = useAtom(rpcEndpointErrorAtom)
  const status = useAtomValue(rpcApiStatusAtom)
  return (
    <FormControl isInvalid={error !== '' || validateError !== ''}>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">RPC Endpoint</FormLabel>
      <div tw="px-4">
        <InputGroup>
          <Input
            pr="5.5rem"
            css={tw`text-sm font-mono bg-gray-200 outline-none`}
            type='text'
            value={input}
            onChange={ev => {
              setInput(ev.target.value)
              setValidateError('')
              setError('')
            }}
          />
          <InputRightElement w="5.6rem" mr="1">
            <Button
              tw="bg-black text-gray-300 border border-solid border-[#f3f3f3] hover:bg-[#f3f3f3] hover:text-black"
              h="1.75rem"
              mr="0.3rem"
              size="sm"
              isLoading={status === 'connecting'}
              isDisabled={status === 'connected' && input === endpoint}
              onClick={() => {
                if (input.indexOf('wss://') !== 0 || input.indexOf('ws://') !== 0) {
                  setValidateError('Invalid RPC Endpoint URL')
                  setEndpoint('')
                } else {
                  setEndpoint(input)
                }
              }}
            >
              {status === 'connected' && input === endpoint ? 'connected' : 'connect'}
            </Button>
          </InputRightElement>
        </InputGroup>
        <FormErrorMessage>
          {validateError || error}
        </FormErrorMessage>
      </div>
    </FormControl>
  )
}
