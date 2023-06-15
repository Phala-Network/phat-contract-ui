import type { SelectorOption } from '../atoms'

import React from 'react'
import tw from 'twin.macro'
import { Abi } from '@polkadot/api-contract'
import { FormControl, FormLabel } from '@chakra-ui/react'
import { atom, useSetAtom, useAtomValue } from 'jotai'
import * as R from 'ramda'

import ArgumentsForm from './contract-method-arguments-form'
import { candidateAtom, candidateFileInfoAtom, contractSelectorOptionListAtom, contractSelectedInitSelectorAtom } from '../atoms'
import { argumentFormAtomsWithAbiAndLabel, getFormValue } from '../argumentsFormAtom'

const candidateAbiAtom = atom(get => {
  const contract = get(candidateAtom)
  if (!contract) {
    return null
  }
  try {
    return new Abi(contract)
  } catch (err) {
    return null
  }
})

const currentConstructorLabelAtom = atom(get => {
  const selectors = get(contractSelectorOptionListAtom)
  const chooseSelectors = R.head(selectors.filter(i => i.selected))
  if (chooseSelectors) {
    return chooseSelectors.label
  }
  const defaultSelectors = R.pipe(
    R.filter((c: SelectorOption) => c.label === 'default' || c.label === 'new'),
    R.sortBy((c: SelectorOption) => c.argCounts),
    i => R.head<SelectorOption>(i),
  )(selectors)
  if (defaultSelectors) {
    return defaultSelectors.label
  }
  return ''
})

export const [constructorArgumentFormAtom, constructorFormFieldAtom] = argumentFormAtomsWithAbiAndLabel(
  candidateAbiAtom,
  currentConstructorLabelAtom,
  'constructor'
)

export const constructorArgumentsAtom = atom(get => {
  const abi = get(candidateAbiAtom)
  const selected = get(currentConstructorLabelAtom)
  const constructor = abi?.constructors.find(i => i.identifier === selected)
  if (!constructor) {
    return []
  }
  if (constructor.args.length === 0) {
    return []
  }
  const inputs = getFormValue(get(get(constructorArgumentFormAtom)))
  const args = R.map(i => inputs[i.name], constructor.args)
  return args
})

const InitSelectorField = () => { 
  const finfo = useAtomValue(candidateFileInfoAtom)
  const selectors = useAtomValue(contractSelectorOptionListAtom)
  const setInitSelector = useSetAtom(contractSelectedInitSelectorAtom)
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
              (item.selected || selected?.value === item.value) && tw`border-phalaDark-500 bg-phalaDark-800`,
            ]}
          >
            <input
              type="radio"
              name="init-selector"
              value={item.value}
              checked={item.selected || selected?.value === item.value}
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
      {(selected?.argCounts || 0) > 0 ? (
        <div tw="my-4 ml-0.5 pl-4 py-2.5 border-l border-solid border-phalaDark-500">
          <ArgumentsForm theAtom={constructorFormFieldAtom} />
        </div>
      ) : null}
    </FormControl>
  )
}

export default InitSelectorField