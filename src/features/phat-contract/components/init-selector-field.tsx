import type { SelectorOption } from '../atoms'

import React from 'react'
import tw from 'twin.macro'
import { FormControl, FormLabel } from '@chakra-ui/react'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'
import * as R from 'ramda'

import { candidateFileInfoAtom, contractSelectorOptionListAtom, contractSelectedInitSelectorAtom } from '../atoms'

const InitSelectorField = () => { 
  const finfo = useAtomValue(candidateFileInfoAtom)
  const selectors = useAtomValue(contractSelectorOptionListAtom)
  const setInitSelector = useUpdateAtom(contractSelectedInitSelectorAtom)
  if (!finfo.size || !selectors.length) {
    return <></>
  }
  const chooseSelectors = R.head(selectors.filter(i => i.selected))
  const defaultSelectors = R.pipe(
    R.filter((c: SelectorOption) => c.label === 'default' || c.label === 'new'),
    R.sortBy((c: SelectorOption) => c.argCounts),
    i => R.head<SelectorOption>(i),
  )(selectors)
  const selected = chooseSelectors || defaultSelectors
  return (
    <FormControl>
      <FormLabel>Constructor</FormLabel>
      <div tw="grid grid-cols-3 gap-2.5">
        {selectors.map((item, idx) => (
          <label
            key={idx}
            css={[
              tw`flex flex-col items-center border border-solid border-gray-500 rounded p-2.5 cursor-pointer hover:bg-phalaDark-700`,
              item.argCounts > 0 && tw`cursor-not-allowed opacity-50`,
              (item.selected || selected?.value === item.value) && tw`border-phalaDark-500 bg-phalaDark-800`,
            ]}
          >
            <input
              type="radio"
              name="init-selector"
              value={item.value}
              checked={item.selected || selected?.value === item.value}
              disabled={item.argCounts > 0}
              onChange={evt => {
                setInitSelector(evt.target.value)
              }}
              tw="sr-only"
            />
            <div tw="flex flex-row items-center leading-none">
              <code tw="">{item.label}</code>
              <code tw="ml-2 mt-1 text-xs text-gray-400">{item.value}</code>
            </div>
          </label>
        ))}
      </div>
    </FormControl>
  )
}

export default InitSelectorField