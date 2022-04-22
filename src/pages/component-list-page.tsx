import React, { useState } from 'react'
import tw from 'twin.macro'
import { Heading, Box, Button, Input, Switch, FormControl, FormLabel } from '@chakra-ui/react'

import { BoolInput } from '@/features/ui/inputs/bool'
import { TextInput } from '@/features/ui/inputs/text'


const SimpleArgs = [
  {
    "label": "init_value",
    "type": {
      "displayName": [
        "bool"
      ],
      "type": 0
    }
  }
]

const ComponentListPage = () => {
  const [foo, setFoo] = React.useState(false)
  return (
    <Box>
      <Heading>Components</Heading>
      <Box my="2" p="8" bg="white">
        <FormControl>
          <FormLabel>Boolean</FormLabel>
          <div tw="px-4 pt-2 pb-4">
            <BoolInput value={foo} onChange={setFoo} />
          </div>
        </FormControl>
        <FormControl>
          <FormLabel>Text</FormLabel>
          <div tw="px-4 pt-2 pb-4">
            <TextInput />
          </div>
        </FormControl>
        <FormControl>
          <FormLabel>Switch</FormLabel>
          <div tw="px-4 pt-2 pb-4">
            <Switch />
          </div>
        </FormControl>
      </Box>
    </Box>
  )
}

export default ComponentListPage