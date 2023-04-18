import type { AbiParam } from '@polkadot/api-contract/types'
import { ChangeEvent, memo, useEffect, useState } from 'react'
import React, { useMemo } from 'react'
import tw from 'twin.macro'
import { TypeDefInfo } from '@polkadot/types'
import { Box, Button, Center, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Input, ListItem, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Select, Stack, Switch, Text, UnorderedList } from '@chakra-ui/react'
import { IoRemove, IoAdd } from "react-icons/io5"
import { useAtomValue } from 'jotai'
import { isNumberLikeType, isBoolType, subToArray, PlainType, validateNotUndefined, convertToBN, cantToNumberMessage } from '@/functions/argumentsValidator'
import { currentArgsFormAtomInAtom, currentFieldDataSetReadOnlyAtom, dispatchErrors, dispatchValue, FieldData, FormAction, FormActionType, formReducer, ValueTypeNormalized } from '../argumentsFormAtom'
import createLogger from '@/functions/createLogger'
import { selectAtom, useReducerAtom } from 'jotai/utils'
import { v4 as uuidV4 } from 'uuid'

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
  dispatch: (action: FormAction) => void
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

  console.log('NumberLikeTypeFieldData render: fieldData', fieldData)

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
      const nextValue = convertToBN(innerValue)
      if (nextValue) {
        dispatchValue(dispatch, uid, nextValue)
        dispatchErrors(dispatch, uid, [])
      } else {
        dispatchValue(dispatch, uid, undefined)
        const errors = cantToNumberMessage(innerValue).errors
        dispatchErrors(dispatch, uid, errors)
      }
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

  console.log('BoolTypeFieldData render: fieldData', fieldData)

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

const EnumTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
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
        variant && variant.type !== 'Null' && variantIndex !== undefined
          ? (
            <>
              <FormLabel mt={FIELD_GAP}>Enter a value for selected variant</FormLabel>
              <ArgumentFieldData uid={subFieldData[variantIndex]} dispatch={dispatch} />
            </>
          )
          : null
      }
    </>
  )
}

const OptionTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
  const { uid, value, optionField } = fieldData

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
          ? <ArgumentFieldData uid={optionField as string} dispatch={dispatch} />
          : null
      }
    </>
  )
}

const StructTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
  const { value } = fieldData
  const structValue = value as Record<string, string>
  const names = Object.keys(structValue)

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
          names.map((name, index) => {
            const id = uuidV4()
            return (
              <Box key={index}>
                <FormLabel htmlFor={id}>
                  {name}
                </FormLabel>
                <Box id={id}>
                  <ArgumentFieldData uid={structValue[name]} dispatch={dispatch} />
                </Box>
              </Box>
            )}
          )
        }
      </Stack>
    </Box>
  )
}

const TupleOrVecFixedTypeFieldData = ({ fieldData, dispatch }: EachFieldDataProps) => {
  const { value } = fieldData
  const subFieldsUid = value as string[]

  debug('TupleOrVecFixedTypeFieldData render: fieldData', fieldData)

  return (
    <Stack spacing={FIELD_GAP}>
      {
        subFieldsUid.map((uid, index) => {
          return (
            <Flex key={index}>
              <Center w="40px" bgColor="whiteAlpha.200" borderRadius="md">
                <Text color="white">{index}</Text>
              </Center>
              <Box ml={FIELD_GAP} flex={1}>
                <ArgumentFieldData uid={uid} dispatch={dispatch} />
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
  dispatch,
  removeSubField,
  index,
  removeDisabled,
}: {
  uid: string
  index: number
  removeDisabled: boolean
  removeSubField: (uid: string) => void
} & FieldDataProps) => {

  const handleRemove = () => {
    removeSubField(uid)
  }

  return (
    <Flex key={uid}>
      <Center w="40px" bgColor="whiteAlpha.200" borderRadius="md">
        <Text color="white">{index}</Text>
      </Center>
      <Box ml={FIELD_GAP} flex={1}>
        <ArgumentFieldData uid={uid} dispatch={dispatch} />
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

const VecTypeDataEntry = ({ fieldData, dispatch }: EachFieldDataProps) => {
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

  const removeDisabled = subFieldsUid.length <= 1

  return (
    <Stack spacing={FIELD_GAP}>
      {
        subFieldsUid.map((subUid, index) => (
          <VecTypeItemFieldData
            uid={subUid}
            dispatch={dispatch}
            removeSubField={removeSubField}
            removeDisabled={removeDisabled}
            index={index}
            key={index}
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

  useEffect(() => {
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
      }
      dispatchValue(dispatch, uid, nextValue)
    }
  }, [innerValue])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInnerValue(event.target.value)
  }

  const handleBlur = () => {
    const errors = validateNotUndefined(value)
    dispatchErrors(dispatch, uid, errors)
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <Input value={innerValue} onChange={handleChange} onBlur={handleBlur} placeholder="Input a string" />
      <ArgumentErrors errors={errors} />
    </FormControl>
  )
}

const ArgumentFieldData = ({ uid, dispatch }: FieldDataProps) => {
  const fieldDataAtom = useMemo(() => selectAtom(currentFieldDataSetReadOnlyAtom, sets => sets[uid]), [uid])
  const fieldData = useAtomValue(fieldDataAtom)

  const { typeDef: { info } } = fieldData

  console.log('[Top] ArgumentFieldData render', fieldDataAtom, uid)

  switch (info) {
    case TypeDefInfo.Plain:
      return <PlainTypeFieldData fieldData={fieldData} dispatch={dispatch} />
      
    case TypeDefInfo.Enum:
      return <EnumTypeFieldData fieldData={fieldData} dispatch={dispatch} />

    case TypeDefInfo.Option:
      return <OptionTypeFieldData fieldData={fieldData} dispatch={dispatch} />
    
    case TypeDefInfo.Struct:
      return <StructTypeFieldData fieldData={fieldData} dispatch={dispatch} />
    
    case TypeDefInfo.Tuple:
      return <TupleOrVecFixedTypeFieldData fieldData={fieldData} dispatch={dispatch} />

    case TypeDefInfo.VecFixed:
      return <TupleOrVecFixedTypeFieldData fieldData={fieldData} dispatch={dispatch} />

    case TypeDefInfo.Vec:
      return <VecTypeDataEntry fieldData={fieldData} dispatch={dispatch} />
  
    default:
      return <OtherTypeFieldData fieldData={fieldData} dispatch={dispatch} />
  }
}

const ArgumentForm = memo(({
  name,
  uid,
  dispatch,
}: {
  name: string
} & FieldDataProps) => {
  // If no useMemo, component will re-render always.
  const fieldDataAtom = useMemo(() => selectAtom(currentFieldDataSetReadOnlyAtom, sets => sets[uid]), [uid])
  const { displayType = '', value  } = useAtomValue(fieldDataAtom)

  debug('[Each] ArgumentForm render', fieldDataAtom, value, uid)

  return (
    <FormControl>
      <FormLabel>
        {name}
        <code tw="ml-2 text-xs text-gray-500 font-mono">{displayType}</code>
      </FormLabel>
      <ArgumentFieldData uid={uid} dispatch={dispatch} />
    </FormControl>
  )
})

const ArgumentsForm = () => {
  const currentArgsFormAtom = useAtomValue(currentArgsFormAtomInAtom)
  const [currentArgsForm, dispatch] = useReducerAtom(currentArgsFormAtom, formReducer)
  const { formData } = currentArgsForm
  const args = Object.keys(formData)

  debug('[Total] ArgumentsForm render', currentArgsForm)

  return (
    <Stack spacing="16px">
      {
        args.map((name, index) => {
          const uid = formData[name]
          return (
            <ArgumentForm
              key={index}
              name={name}
              uid={uid}
              dispatch={dispatch}
            />
          )
        })
      }
    </Stack>
  )
}

export default ArgumentsForm