import type { AbiParam } from '@polkadot/api-contract/types'
import { ChangeEvent, memo, useEffect, useState } from 'react'
import React, { useMemo } from 'react'
import tw from 'twin.macro'
import { TypeDefInfo } from '@polkadot/types'
import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  ListItem,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  type TextareaProps,
  UnorderedList
} from '@chakra-ui/react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { IoRemove, IoAdd } from "react-icons/io5"
import { useAtomValue, useAtom, WritableAtom } from 'jotai'
import { ErrorBoundary } from 'react-error-boundary'
import * as R from 'ramda'

import {
  isNumberLikeType,
  isBoolType,
  isAddressType,
  subToArray,
  PlainType,
  validateNotUndefined,
  validateAddress,
  validateNumberLikeType,
} from '@/functions/argumentsValidator'
import { ErrorAlert } from '@/components/ErrorAlert'
import {
  type ArgumentFormAtom,
  dispatchErrors,
  dispatchValue,
  type FieldData,
  type FormAction,
  FormActionType, // Enum
  type ValueTypeNormalized,
  type ArgumentFieldAtom,
} from '../argumentsFormAtom'
import createLogger from '@/functions/createLogger'

const debug = createLogger('contract arguments', 'debug')

export interface ArgumentField {
  abiParam: AbiParam
  displayName: string
  displayType: string
  errors: string[]
  helpText: string
}

interface FieldDataProps {
  uid: string
}

interface EachFieldDataProps {
  fieldData: FieldData<ValueTypeNormalized>
  dispatch: (action: FormAction) => void
}

const FIELD_GAP = '8px'

const ArgumentHelpText = ({ helpText }: Partial<Pick<ArgumentField, 'helpText'>>) => helpText
  ? <FormHelperText>{helpText}</FormHelperText>
  : null

const ArgumentErrors = ({
  errors,
  helpText,
}: {
  errors: string[]
  helpText?: string
}) => {
  const hasErrors = errors.length > 0

  debug('render errors', errors, hasErrors)

  return hasErrors
    ? (
      <FormErrorMessage>
        <UnorderedList>
          {
            errors.map((error, index) => (
              <ListItem key={index}>{error}</ListItem>
            ))
          }
        </UnorderedList>
      </FormErrorMessage>
    )
    : <ArgumentHelpText helpText={helpText} />
}

/**
 * ---------------------------------------
 *        Each Data Entry Component
 * ---------------------------------------
 */

// A number input.
const NumberLikeTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
  const { uid, typeDef, value, errors = [] } = fieldData
  const { type } = typeDef
  const isUnsignedNumber = type.startsWith('u')
  const min = isUnsignedNumber ? 0 : undefined
  const placeholder = `Input a number${isUnsignedNumber ? ' >= 0' : ''}`
  const isInvalid = errors.length > 0
  const [innerValue, setInnerValue] = useState(value?.toString() || '')

  useEffect(() => {
    setInnerValue(value?.toString() || '')
  }, [value])

  const handleBlur = () => {
    debug('innerValue', innerValue)
    if (!innerValue) {
      dispatchValue(dispatch, uid, undefined)
      const errors = validateNotUndefined(undefined)
      dispatchErrors(dispatch, uid, errors)
    } else {
      const { errors } = validateNumberLikeType(fieldData.typeDef, innerValue as string | number)
      dispatchErrors(dispatch, uid, errors)
      if (errors.length > 0) {
        dispatchValue(dispatch, uid, undefined)
        return
      }
      dispatchValue(dispatch, uid, innerValue)
    }
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <NumberInput
        value={innerValue}
        onChange={setInnerValue}
        onBlur={handleBlur}
        min={min}
      >
        <NumberInputField placeholder={placeholder} />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      <ArgumentErrors errors={errors} />
    </FormControl>
  )
}

const BoolTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
  const { uid, errors = [] } = fieldData
  const isInvalid = errors.length > 0

  const [innerValue, setInnerValue] = useState('')

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextInnerValue = event.target.value
    setInnerValue(nextInnerValue)

    let nextValue = undefined
    if (nextInnerValue) {
      nextValue = nextInnerValue === '1' ? true : false
    }
    dispatchValue(dispatch, uid, nextValue)
    const errors = validateNotUndefined(nextValue)
    dispatchErrors(dispatch, uid, errors)
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <Select placeholder="Select option" value={innerValue} onChange={handleChange}>
        <option value="1">true</option>
        <option value="0">false</option>
      </Select>
      <ArgumentErrors errors={errors} />
    </FormControl>
  )
}

const PlainTypeFieldData = (props: EachFieldDataProps) => {
  const { fieldData } = props
  const { typeDef: { type } } = fieldData

  if (isNumberLikeType(type as PlainType)) {
    return <NumberLikeTypeFieldData {...props} />
  } else if (isBoolType(type as PlainType)) {
    return <BoolTypeFieldData {...props} />
  }

  return <OtherTypeFieldData {...props} />
}

const EnumTypeFieldData = ({ fieldData, dispatch, allAtoms }: EachFieldDataProps & { allAtoms: Record<string, ArgumentFieldAtom> }) => {
  const { uid, typeDef, enumFields, errors = [] } = fieldData
  const subFieldData = enumFields as string[]

  const [selectedVariantName, setSelectedVariantName] = useState<string>()

  const { sub } = typeDef

  const variants = subToArray(sub)

  const variantIndex = selectedVariantName !== undefined
    ? variants.findIndex(variantItem => variantItem.name === selectedVariantName)
    : undefined

  const variant = variantIndex !== undefined && variantIndex >= 0
    ? variants[variantIndex]
    : undefined

  useEffect(() => {
    if (variantIndex !== undefined && variant && selectedVariantName) {
      let nextValue: Record<string, string | null> = { [selectedVariantName]: null }
      if (variant.type !== 'Null') {
        nextValue = { [selectedVariantName]: subFieldData[variantIndex] }
      }
      dispatchValue(dispatch, uid, nextValue)
    } else {
      dispatchValue(dispatch, uid, undefined)
    }
  }, [variant, variantIndex, selectedVariantName, subFieldData])

  const theAtom = useMemo(() => {
    if (subFieldData && variantIndex !== undefined) {
      return allAtoms[subFieldData[variantIndex]]
    }
    return undefined
  }, [allAtoms, subFieldData, variantIndex])

  const isInvalid = errors.length > 0

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSelectedVariantName(value)
    const errors = validateNotUndefined(value)
    dispatchErrors(dispatch, uid, errors)
  }

  debug('EnumTypeFieldData render: variant, fieldData', variant, fieldData)

  return (
    <>
      <FormControl isInvalid={isInvalid}>
        <Select
          value={selectedVariantName}
          onChange={handleSelectChange}
          placeholder="Select a variant"
        >
          {
            variants.map((subItem, index) => {
              const { name } = subItem
              return (
                <option key={index} value={name}>{name}</option>
              )
            })
          }
        </Select>
        <ArgumentErrors errors={errors} />
      </FormControl>
      {
        variant && variant.type !== 'Null' && variantIndex !== undefined && theAtom
          ? (
            <>
              <FormLabel mt={FIELD_GAP}>Enter a value for selected variant</FormLabel>
              <ArgumentFieldData uid={subFieldData[variantIndex]} theAtom={theAtom} allAtoms={allAtoms} />
            </>
          )
          : null
      }
    </>
  )
}

const OptionTypeFieldData = ({ fieldData, dispatch, allAtoms }: EachFieldDataProps & { allAtoms: Record<string, ArgumentFieldAtom> }) => {
  const { uid, value, optionField } = fieldData

  const theAtom = useMemo(() => allAtoms[optionField as string], [allAtoms, optionField])

  debug('OptionTypeFieldData render: fieldData', fieldData)

  const enableOption = Boolean(value)

  const handleSwitchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked
    const nextValue = checked ? optionField as string : null
    dispatchValue(dispatch, uid, nextValue)
  }

  return (
    <>
      <Flex>
        <FormLabel htmlFor={uid} mb={enableOption ? undefined : 0} >Enable data entry:</FormLabel>
        <Switch id={uid} checked={enableOption} onChange={handleSwitchChange} />
      </Flex>
      {
        enableOption
          ? <ArgumentFieldData uid={optionField as string} theAtom={theAtom} allAtoms={allAtoms} />
          : null
      }
    </>
  )
}

const StructTypeFieldData = ({ fieldData, allAtoms }: EachFieldDataProps & { allAtoms: Record<string, ArgumentFieldAtom> }) => {
  const { value } = fieldData
  const structValue = value as Record<string, string>
  const names = Object.keys(structValue)

  const atoms = useMemo(() => {
    return names.map(name => ({
      name,
      uid: structValue[name],
      theAtom: allAtoms[structValue[name]],
    }))
  }, [structValue, names])

  debug('StructTypeFieldData render: fieldData', fieldData)

  return (
    <Box
      borderWidth="1px"
      borderStyle="solid"
      borderColor="chakra-border-color"
      borderRadius="md"
      p={FIELD_GAP}
    >
      <Stack spacing={FIELD_GAP}>
        {
          atoms.map(({name, uid, theAtom}, index) => {
            return (
              <Box key={index}>
                <FormLabel htmlFor={uid}>
                  {name}
                </FormLabel>
                <Box id={uid}>
                  <ArgumentFieldData uid={uid} theAtom={theAtom} allAtoms={allAtoms} />
                </Box>
              </Box>
            )}
          )
        }
      </Stack>
    </Box>
  )
}

const TupleOrVecFixedTypeFieldData = ({ fieldData, allAtoms }: EachFieldDataProps & { allAtoms: Record<string, ArgumentFieldAtom> }) => {
  const { value } = fieldData
  const subFieldsUid = value as string[]
  const atoms = useMemo(() => subFieldsUid.map((uid) => ({
    uid,
    theAtom: allAtoms[uid]
  })), [allAtoms, subFieldsUid])

  debug('TupleOrVecFixedTypeFieldData render: fieldData', fieldData)

  return (
    <Stack spacing={FIELD_GAP}>
      {
        atoms.map(({ uid, theAtom }, index) => {
          return (
            <Flex key={index}>
              <Center w="40px" bgColor="whiteAlpha.200" borderRadius="md">
                <Text color="white">{index}</Text>
              </Center>
              <Box ml={FIELD_GAP} flex={1}>
                <ArgumentFieldData uid={uid} theAtom={theAtom} allAtoms={allAtoms} />
              </Box>
            </Flex>
          )
        })
      }
    </Stack>
  )
}

const VecTypeItemFieldData = ({
  uid,
  removeSubField,
  index,
  removeDisabled,
  allAtoms,
}: {
  uid: string
  index: number
  removeDisabled: boolean
  removeSubField: (uid: string) => void
  allAtoms: Record<string, ArgumentFieldAtom>
} & FieldDataProps) => {

  const theAtom = useMemo(() => allAtoms[uid], [uid, allAtoms])

  const handleRemove = () => {
    removeSubField(uid)
  }

  return (
    <Flex key={uid}>
      <Center w="40px" bgColor="whiteAlpha.200" borderRadius="md">
        <Text color="white">{index}</Text>
      </Center>
      <Box ml={FIELD_GAP} flex={1}>
        <ArgumentFieldData uid={uid} theAtom={theAtom} allAtoms={allAtoms} />
      </Box>
      <Center
        ml={FIELD_GAP}
        cursor="pointer"
        _hover={{
          bgColor: 'whiteAlpha.300'
        }}
        _active={{
          bgColor: 'whiteAlpha.400'
        }}
        w="40px"
        bgColor="whiteAlpha.200"
        borderRadius="md"
        display={removeDisabled ? 'none' : undefined}
        onClick={handleRemove}
      >
        <IoRemove />
      </Center>
    </Flex>
  )
}

const VecTypeDataEntry = ({ fieldData, dispatch, allAtoms }: EachFieldDataProps & { allAtoms: Record<string, ArgumentFieldAtom> }) => {
  const { uid, typeDef: { sub }, value } = fieldData
  const subFieldsUid = value as string[]
  const subTypeDef = subToArray(sub)[0]

  debug('VecTypeDataEntry render: fieldData', fieldData)

  const addSubField = () => dispatch({
    type: FormActionType.AddSubField,
    payload: {
      uid,
      typeDef: subTypeDef,
    }
  })

  const removeSubField = (subUid: string) => dispatch({
    type: FormActionType.RemoveSubField,
    payload: {
      uid,
      subUid,
    }
  })

  const removeDisabled = subFieldsUid.length <= 0

  return (
    <Stack spacing={FIELD_GAP}>
      {
        subFieldsUid.map((subUid, index) => (
          <VecTypeItemFieldData
            uid={subUid}
            removeSubField={removeSubField}
            removeDisabled={removeDisabled}
            index={index}
            key={index}
            allAtoms={allAtoms}
          />
        ))
      }
      <Box pl="48px" pr={removeDisabled ? 0 : '48px'}>
        <Button
          leftIcon={<IoAdd />}
          w="100%"
          onClick={addSubField}
        >
          Add
        </Button>
      </Box>
    </Stack>
  )
}

const OtherTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
  const { uid, value, typeDef: { type }, errors = [] } = fieldData
  const isBytes = type === PlainType.Bytes

  const isInvalid = errors.length > 0

  const [innerValue, setInnerValue] = useState('')

  console.log('OtherTypeFieldData render: fieldData', fieldData)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInnerValue(event.target.value)
  }

  const handleBlur = () => {
    if (!innerValue) {
      dispatchValue(dispatch, uid, undefined)
    } else {
      let nextValue: ValueTypeNormalized = innerValue
      if (isBytes) {
        try {
          const maybeArray = JSON.parse(nextValue)
          if (Array.isArray(maybeArray)) {
            nextValue = maybeArray
          }
        } catch (error) {
          // noop
        }
      } else if (isAddressType(type as PlainType)) {
        const { errors } = validateAddress(fieldData.typeDef, nextValue as string)
        dispatchErrors(dispatch, uid, errors)
        if (errors.length > 0) {
          dispatchValue(dispatch, uid, undefined)
          return
        }
      }
      dispatchValue(dispatch, uid, nextValue)
    }
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <Input value={innerValue} onChange={handleChange} onBlur={handleBlur} placeholder="Input a string" />
      <ArgumentErrors errors={errors} />
    </FormControl>
  )
}

function TextAreaWidget({ fieldData, dispatch, ...props }: EachFieldDataProps & TextareaProps) {
  const { uid, value, errors = [] } = fieldData
  const isInvalid = errors.length > 0
  const [innerValue, setInnerValue] = useState('')

  useEffect(() => {
    if (!innerValue) {
      dispatchValue(dispatch, uid, undefined)
    } else {
      let nextValue: ValueTypeNormalized = innerValue
      dispatchValue(dispatch, uid, nextValue)
    }
  }, [innerValue])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInnerValue(event.target.value)
  }

  const handleBlur = () => {
    const errors = validateNotUndefined(value)
    dispatchErrors(dispatch, uid, errors)
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <Textarea {...props} value={innerValue} onChange={handleChange} onBlur={handleBlur} placeholder="Input a string" />
      <ArgumentErrors errors={errors} />
    </FormControl>
  )
}

function CodeMirrorWidget({ fieldData, dispatch, lang }: EachFieldDataProps & { lang: 'javascript' | 'json' | 'markdown'}) {
  const { uid, value, errors = [] } = fieldData
  const isInvalid = errors.length > 0
  const extensions = useMemo(() => {
    if (lang === 'json') {
      return [json()]
    } else if (lang === 'markdown') {
      return [markdown()]
    } else {
      return [javascript()]
    }
  }, [lang])

  return (
    <FormControl isInvalid={isInvalid}>
      <CodeMirror
        tw="font-mono"
        value={(value as string) || ''}
        onChange={(value) => {
          dispatchValue(dispatch, uid, value)
          const errors = validateNotUndefined(value)
          dispatchErrors(dispatch, uid, errors)
        }}
        extensions={extensions}
        theme={vscodeDark}
      />
      <ArgumentErrors errors={errors} />
    </FormControl>
  )
}

//
//

const ArgumentFieldData = ({ uid, theAtom, allAtoms = {} }: { uid: string, theAtom: ArgumentFieldAtom, allAtoms?: Record<string, ArgumentFieldAtom> }) => {
  const [fieldData, dispatch] = useAtom(theAtom)

  const { typeDef: { info } } = fieldData
  const uiSchema = fieldData.uiSchema || {}

  if (uiSchema['ui:widget'] === 'textarea') {
    return <TextAreaWidget fieldData={fieldData} dispatch={dispatch} rows={Number(uiSchema['ui:rows']) || 6} />
  }
  if (uiSchema['ui:widget'] === 'codemirror') {
    return <CodeMirrorWidget fieldData={fieldData} dispatch={dispatch} lang={R.pathOr('javascript', ['ui:options', 'lang'], uiSchema)} />
  }

  switch (info) {
    case TypeDefInfo.Plain:
      return <PlainTypeFieldData fieldData={fieldData} dispatch={dispatch} />
      
    case TypeDefInfo.Enum:
      return <EnumTypeFieldData fieldData={fieldData} dispatch={dispatch} allAtoms={allAtoms} />

    case TypeDefInfo.Option:
      return <OptionTypeFieldData fieldData={fieldData} dispatch={dispatch} allAtoms={allAtoms} />
    
    case TypeDefInfo.Struct:
      return <StructTypeFieldData fieldData={fieldData} dispatch={dispatch} allAtoms={allAtoms} />
    
    case TypeDefInfo.Tuple:
      return <TupleOrVecFixedTypeFieldData fieldData={fieldData} dispatch={dispatch} allAtoms={allAtoms} />

    case TypeDefInfo.VecFixed:
      // [u8;32] or [u8;29]
      if (fieldData.typeDef.type.indexOf('[u8;') === 0) {
        return <PlainTypeFieldData fieldData={fieldData} dispatch={dispatch} />
      }
      return <TupleOrVecFixedTypeFieldData fieldData={fieldData} dispatch={dispatch} allAtoms={allAtoms} />

    case TypeDefInfo.Vec:
      return <VecTypeDataEntry fieldData={fieldData} dispatch={dispatch} allAtoms={allAtoms} />
  
    default:
      return <OtherTypeFieldData fieldData={fieldData} dispatch={dispatch} />
  }
}

const ArgumentField = memo(({
  name,
  uid,
  theAtom,
  allAtoms = {},
}: {
  name: string
  uid: string
  theAtom: ArgumentFieldAtom,
  allAtoms?: Record<string, ArgumentFieldAtom>,
}) => {
  const { displayType = '', value } = useAtomValue(theAtom)

  debug('[Each] ArgumentField render', value, uid)

  return (
    <FormControl>
      <FormLabel>
        {name}
        <code tw="ml-2 text-xs text-gray-500 font-mono">{displayType}</code>
      </FormLabel>
      <ArgumentFieldData uid={uid} theAtom={allAtoms[uid]} allAtoms={allAtoms} />
    </FormControl>
  )
})

export default function ArgumentsForm({ theAtom }: { theAtom: ArgumentFormAtom }) {
  const [argAtoms, allAtoms] = useAtomValue(theAtom)
  return (
    <Stack spacing="16px">
      <ErrorBoundary fallbackRender={ErrorAlert}>
      {
        argAtoms.map(({ name, uid, theAtom }) => (
          <ArgumentField
            key={uid}
            uid={uid}
            name={name}
            theAtom={theAtom}
            allAtoms={allAtoms}
          />
        ))
      }
      </ErrorBoundary>
    </Stack>
  )
}

