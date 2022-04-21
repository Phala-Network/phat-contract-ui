import React from 'react'
import tw from 'twin.macro'
import { Box, SimpleGrid, Heading, Text, Tag } from '@chakra-ui/react'
import { atom } from 'jotai'
import { useAtomValue } from 'jotai/utils'

import { currentContractAtom } from './atoms'
import Code from '@/features/ui/code'


const messagesAtom = atom(get => {
  const contract = get(currentContractAtom)
  if (!contract) {
    return []
  }
  return contract.metadata.V3.spec.messages || []
})


const ContractQueryGrid = () => {
  const messages = useAtomValue(messagesAtom)
  if (!messages.length) {
    return null
  }
  return (
    <SimpleGrid columns={3} spacing={10}>
      {messages.map((message, i) => (
        <Box borderWidth="1px" overflow="hidden" my="2" p="4" bg="gray.800">
          <div tw="flex flex-row items-center">
            <Heading as="h4" size="lg" tw="mr-4">{message.label}</Heading>
            {message.mutates ? (
              <Tag size="sm" colorScheme="phalaDark">tx</Tag>
            ) : (
              <Tag size="sm" colorScheme="phalaDark">query</Tag>
            )}
          </div>
          <div tw="my-1">
            <Code>{message.selector}</Code>
          </div>
          <Text tw="text-gray-200">
            {message.docs.join("")}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  )
}

export default ContractQueryGrid