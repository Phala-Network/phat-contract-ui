import type { FC } from 'react'
import type { RecentSystemEvent } from '@/atoms/foundation'
import type { EventMetadataLatest } from '@polkadot/types/interfaces'

import React from 'react'
import tw from 'twin.macro'
import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Badge,
} from "@chakra-ui/react";
import { formatNumber } from '@polkadot/util'

// These format functions come from @polkadot/app

function splitSingle (value: string[], sep: string): string[] {
  return value.reduce((result: string[], value: string): string[] => {
    return value.split(sep).reduce((result: string[], value: string) => result.concat(value), result);
  }, []);
}

function splitParts (value: string): string[] {
  return ['[', ']'].reduce((result: string[], sep) => splitSingle(result, sep), [value]);
}

function formatMeta (meta?: EventMetadataLatest): React.ReactNode | null {
  if (!meta || !meta.docs.length) {
    return null;
  }

  const strings = meta.docs.map((d) => d.toString().trim());
  const firstEmpty = strings.findIndex((d) => !d.length);
  const combined = (
    firstEmpty === -1
      ? strings
      : strings.slice(0, firstEmpty)
  ).join(' ').replace(/#(<weight>| <weight>).*<\/weight>/, '');
  const parts = splitParts(combined.replace(/\\/g, '').replace(/`/g, ''));

  return <>{parts.map((part, index) => index % 2 ? <em key={index}>[{part}]</em> : <span key={index}>{part}</span>)}&nbsp;</>;
}

// END: format functions

const EventCell: FC<RecentSystemEvent> = ({
  event: { blockHash, record, blockNumber, indexes },
  details: { abiEvent, params, values },
}) => {
  const { event } = record
  return (
    <AccordionItem>
      <Box borderWidth='1px' borderRadius='lg' overflow='hidden' my="2" bg="gray.800">
        <AccordionButton>
          <div tw="w-full">
            <div tw="mb-2 flex flex-row justify-between items-center">
              <div>
                <Badge borderRadius='full' px='2' colorScheme='phala' mr="2">{event.section}</Badge>
                <Badge borderRadius='full' px='2' colorScheme='phalaDark'>{event.method}</Badge>
              </div>
              <div tw="flex flex-row  items-center">
                {blockNumber && (
                  <div tw="text-white text-xs mr-2">
                    {indexes.length !== 1 && <span>({formatNumber(indexes.length)}x)&nbsp;</span>}
                    {formatNumber(blockNumber)}-{indexes[0]}
                  </div>
                )}
                <AccordionIcon />
              </div>
            </div>
            <div tw="text-sm mx-1 text-gray-400 text-left">
              {formatMeta(event.meta)}
            </div>
          </div>
        </AccordionButton>
        <AccordionPanel>
        </AccordionPanel>
      </Box>
    </AccordionItem>
  )
}

export default React.memo(EventCell, (prev, next) => prev.event.blockHash === next.event.blockHash)