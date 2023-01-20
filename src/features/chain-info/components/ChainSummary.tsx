import React from 'react'
import { useAtomValue } from 'jotai';
import { Box, Text, Tooltip } from '@chakra-ui/react'
import { useLastBlock } from '../hooks/useLastBlock'
import { useTarget } from '../hooks/useTarget';
import { lastEventsAtom } from '../atoms';

const BlockTarget = () => {
  const target = useTarget();

  return (
    <>
      {
        target.split(' ').map((value, index) =>
          <span
            key={index}
          >{value}</span>
        )
      }
    </>
  )
}

const ChainSummary = () => {
  const lastBlock = useLastBlock()
  const lastEvents = useAtomValue(lastEventsAtom)

  return (
    <Box>
      <Tooltip label={`Last block: ${lastBlock}`}>
        <Text noOfLines={1}>
          <span>Last block:&nbsp;</span>
          {lastBlock}
        </Text>
      </Tooltip>
      <Tooltip label={<Text>Target: <BlockTarget /></Text>}>
        <Text noOfLines={1}>
          <span>Target:&nbsp;</span>
          <BlockTarget />
        </Text>
      </Tooltip>
      <Tooltip label={`Last events: `}>
        <Text>
          <span>Last events:&nbsp;</span>
          {lastEvents}
        </Text>
      </Tooltip>
    </Box>
  )
}

export default ChainSummary