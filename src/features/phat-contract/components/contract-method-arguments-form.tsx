import type { AbiParam } from '@polkadot/api-contract/types'
import { ChangeEvent, memo, useEffect, useState } from 'react'
import React, { useMemo } from 'react'
import tw from 'twin.macro'
import { TypeDefInfo } from '@polkadot/types'
import { Box, Button, Center, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Input, ListItem, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Select, Stack, Switch, Text, UnorderedList } from '@chakra-ui/react'
import { IoRemove, IoAdd } from "react-icons/io5"
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom, WritableAtom } from 'jotai'
import { isNumberLikeType, isBoolType, subToArray, PlainType, validateNotUndefined, convertToBN, cantToNumberMessage } from '@/functions/argumentsValidator'
import { ArgAtom, createUid, currentArgsFormAtom, DataEntryAtom, DataEntryErrorsAtom, EnumEntity, EnumValue, StructEntity, StructValue, VecEntity } from '../argumentsFormAtom'
import BN from 'bn.js'
import createLogger from '@/functions/createLogger'

const debug = createLogger('contract arguments', 'debug')

export interface ArgumentField {
  abiParam: AbiParam
  displayName: string
  displayType: string
  errors: string[]
  helpText: string
}

interface ArgumentDataEntryProps {
  dataEntryAtom: DataEntryAtom
}

const FIELD_GAP = '8px'

const ArgumentHelpText = ({ helpText }: Partial<Pick<ArgumentField, 'helpText'>>) => helpText
  ? <FormHelperText>{helpText}</FormHelperText>
  : null

const ArgumentErrors = memo(({
  errorsAtom,
  helpText,
}: {
  errorsAtom: DataEntryErrorsAtom
  helpText?: string
}) => {
  const errors = useAtomValue(errorsAtom)
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
})

/**
 * ---------------------------------------
 *        Each Data Entry Component
 * ---------------------------------------
 */

// A number input.
const NumberLikeTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<BN | undefined, BN | undefined>
}) => {
  const { typeDef, entityAtom, errorsAtom } = useAtomValue(dataEntryAtom)
  const { type } = typeDef
  const isUnsignedNumber = type.startsWith('u')
  const min = isUnsignedNumber ? 0 : undefined
  const placeholder = `Input a number${isUnsignedNumber ? ' >= 0' : ''}`
  const [errors, setErrors] = useAtom(errorsAtom)
  const isInvalid = useMemo(() => errors.length > 0, [errors])

  const [value, setValue] = useAtom(entityAtom)
  const [innerValue, setInnerValue] = useState(value?.toString() || '')

  console.log('NumberLikeTypeDataEntry render: fieldData', entityAtom)

  useEffect(() => {
    setInnerValue(value?.toString() || '')
  }, [value])

  const handleBlur = () => {
    debug('innerValue', innerValue)
    if (!innerValue) {
      setValue(undefined)
      const errors = validateNotUndefined(undefined)
      setErrors(errors)
    } else {
      const nextValue = convertToBN(innerValue)
      if (nextValue) {
        setValue(nextValue)
        setErrors([])
      } else {
        setValue(undefined)
        const errors = cantToNumberMessage(innerValue).errors
        setErrors(errors)
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
      <ArgumentErrors errorsAtom={errorsAtom} />
    </FormControl>
  )
})

const BoolTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<boolean | undefined, boolean | undefined>
}) => {
  const { entityAtom, errorsAtom } = useAtomValue(dataEntryAtom)
  const [value, setValue] = useAtom(entityAtom)
  const [errors, setErrors] = useAtom(errorsAtom)
  const isInvalid = useMemo(() => errors.length > 0, [errors])

  console.log('BoolTypeDataEntry render: fieldData', entityAtom)

  const [innerValue, setInnerValue] = useState('')

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextInnerValue = event.target.value
    setInnerValue(nextInnerValue)

    let nextValue = undefined
    if (nextInnerValue) {
      nextValue = nextInnerValue === '1' ? true : false
    }
    setValue(nextValue)
    const errors = validateNotUndefined(nextValue)
    setErrors(errors)
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <Select placeholder="Select option" value={innerValue} onChange={handleChange}>
        <option value="1">true</option>
        <option value="0">false</option>
      </Select>
      <ArgumentErrors errorsAtom={errorsAtom} />
    </FormControl>
  )
})

const PlainTypeDataEntry = memo(({ dataEntryAtom }: ArgumentDataEntryProps) => {
  const { typeDef } = useAtomValue(dataEntryAtom)
  const { type } = typeDef

  console.log('PlainTypeDataEntry render: fieldData', dataEntryAtom)

  if (isNumberLikeType(type as PlainType)) {
    return <NumberLikeTypeDataEntry dataEntryAtom={dataEntryAtom} />
  } else if (isBoolType(type as PlainType)) {
    return <BoolTypeDataEntry dataEntryAtom={dataEntryAtom} />
  }

  return <OtherTypeDataEntry dataEntryAtom={dataEntryAtom} />
})

const EnumTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<EnumEntity, EnumValue>
}) => {
  const { typeDef, entityAtom, errorsAtom, selectedVariantNameAtom } = useAtomValue(dataEntryAtom)
  const [selectedVariantName, setSelectedVariantName] = useAtom(selectedVariantNameAtom as PrimitiveAtom<string | undefined>)
  const entity = useAtomValue(entityAtom)
  const [errors, setErrors] = useAtom(errorsAtom)

  console.log('EnumTypeDataEntry render: fieldData', entityAtom)

  const { sub } = typeDef

  const variants = subToArray(sub)

  const variantIndex = useMemo(() => {
    if (selectedVariantName !== undefined) {
      return variants.findIndex(variantItem => variantItem.name === selectedVariantName)
    }
    return undefined
  }, [variants, selectedVariantName])

  const variant = useMemo(() => {
    if (variantIndex !== undefined && variantIndex >= 0) {
      return variants[variantIndex]
    }
  }, [variants, variantIndex])

  const isInvalid = useMemo(() => errors.length > 0, [errors])

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSelectedVariantName(value)
    const errors = validateNotUndefined(value)
    setErrors(errors)
  }

  debug('variant', variant)

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
        <ArgumentErrors errorsAtom={errorsAtom} />
      </FormControl>
      {
        variant && variant.type !== 'Null' && entity
          ? (
            <>
              <FormLabel mt={FIELD_GAP}>Enter a value for selected variant</FormLabel>
              <ArgumentDataEntry dataEntryAtom={entity[variantIndex as number]} />
            </>
          )
          : null
      }
    </>
  )
})

const OptionTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<DataEntryAtom, unknown | null>
}) => {
  const { entityAtom, enableOptionAtom } = useAtomValue(dataEntryAtom)
  const [enableOption, setEnableOption] = useAtom(enableOptionAtom as PrimitiveAtom<boolean>)
  const entityItemAtom = useAtomValue(entityAtom)

  const uid = createUid()

  const handleSwitchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked
    setEnableOption(checked)
  }

  console.log('OptionTypeDataEntry render: fieldData', entityAtom)

  return (
    <>
      <Flex>
        <FormLabel htmlFor={uid} mb={enableOption ? undefined : 0} >Enable data entry:</FormLabel>
        <Switch id={uid} checked={enableOption} onChange={handleSwitchChange} />
      </Flex>
      {
        enableOption
          ? <ArgumentDataEntry dataEntryAtom={entityItemAtom} />
          : null
      }
    </>
  )
})

const StructTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<StructEntity, StructValue>
}) => {
  const { entityAtom } = useAtomValue(dataEntryAtom)
  const entity = useAtomValue(entityAtom)
  const entityKeys = Object.keys(entity)

  console.log('StructTypeDataEntry render: fieldData', entityAtom)

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
          entityKeys.map((entityKey, index) => {
            const id = createUid()
            return (
              <Box key={index}>
                <FormLabel htmlFor={id}>
                  {entityKey}
                </FormLabel>
                <Box id={id}>
                  <ArgumentDataEntry dataEntryAtom={entity[entityKey]} />
                </Box>
              </Box>
            )}
          )
        }
      </Stack>
    </Box>
  )
})

const TupleOrVecFixedTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<VecEntity, unknown[]>
}) => {
  const { entityAtom } = useAtomValue(dataEntryAtom)
  const entity = useAtomValue(entityAtom)

  console.log('TupleOrVecFixedTypeDataEntry render: fieldData', entityAtom)

  return (
    <Stack spacing={FIELD_GAP}>
      {
        entity.map((entityItemAtom, index) => {
          return (
            <Flex key={index}>
              <Center w="40px" bgColor="whiteAlpha.200" borderRadius="md">
                <Text color="white">{index}</Text>
              </Center>
              <Box ml={FIELD_GAP} flex={1}>
                <ArgumentDataEntry dataEntryAtom={entityItemAtom} />
              </Box>
            </Flex>
          )
        })
      }
    </Stack>
  )
})

const VecTypeItemDataEntry = memo(({
  entityItemAtom,
  removeEntity,
  index,
  removeDisabled,
}: {
  entityItemAtom: DataEntryAtom
  removeEntity: (id: string) => void
  index: number
  removeDisabled: boolean
}) => {
  const entityItem = useAtomValue(entityItemAtom)
  const { id } = entityItem

  console.log('VecTypeItemDataEntry render: fieldData', entityItemAtom)

  const removeItem = () => {
    removeEntity(id)
  }

  return (
    <Flex key={id}>
      <Center w="40px" bgColor="whiteAlpha.200" borderRadius="md">
        <Text color="white">{index}</Text>
      </Center>
      <Box ml={FIELD_GAP} flex={1}>
        <ArgumentDataEntry dataEntryAtom={entityItemAtom} />
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
        onClick={removeItem}
      >
        <IoRemove />
      </Center>
    </Flex>
  )
})

const VecTypeDataEntry = memo(({
  dataEntryAtom,
}: {
  dataEntryAtom: DataEntryAtom<VecEntity, unknown[]>
}) => {
  const { typeDef, entityAtom, dispatches } = useAtomValue(dataEntryAtom)
  const entity = useAtomValue(entityAtom)
  const { addEntity: addEntityAtom, removeEntity: removeEntityAtom } = dispatches as {
    addEntity: WritableAtom<null, unknown, void>
    removeEntity: WritableAtom<null, string, void>
  }
  const addEntity = useSetAtom(addEntityAtom)
  const removeEntity = useSetAtom(removeEntityAtom)

  console.log('VecTypeDataEntry render: fieldData', entityAtom)

  const removeDisabled = entity.length <= 1

  return (
    <Stack spacing={FIELD_GAP}>
      {
        entity.map((entityItemAtom, index) => (
          <VecTypeItemDataEntry
            entityItemAtom={entityItemAtom}
            removeEntity={removeEntity}
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
          onClick={addEntity}
        >
          Add
        </Button>
      </Box>
    </Stack>
  )
})

const OtherTypeDataEntry = memo(({ dataEntryAtom }: {
  dataEntryAtom: DataEntryAtom<string | undefined, string | undefined>
}) => {
  const { entityAtom, errorsAtom } = useAtomValue(dataEntryAtom)
  const [value, setValue] = useAtom(entityAtom)
  const [errors, setErrors] = useAtom(errorsAtom)
  const isInvalid = useMemo(() => errors.length > 0, [errors])

  const [innerValue, setInnerValue] = useState('')

  console.log('OtherTypeFieldData render: fieldData', entityAtom)

  useEffect(() => {
    if (!innerValue) {
      setValue(undefined)
    } else {
      setValue(innerValue)
    }
  }, [innerValue])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInnerValue(event.target.value)
  }

  const handleBlur = () => {
    const errors = validateNotUndefined(value)
    setErrors(errors)
  }

  return (
    <FormControl isInvalid={isInvalid}>
      <Input value={innerValue} onChange={handleChange} onBlur={handleBlur} placeholder="Input a string" />
      <ArgumentErrors errorsAtom={errorsAtom} />
    </FormControl>
  )
})

const ArgumentDataEntry = memo(({
  dataEntryAtom,
}: ArgumentDataEntryProps) => {
  const { typeDef: { info } } = useAtomValue(dataEntryAtom)

  debug('[Top] ArgumentFieldData render', dataEntryAtom)

  switch (info) {
    case TypeDefInfo.Plain:
      return <PlainTypeDataEntry dataEntryAtom={dataEntryAtom} />

    case TypeDefInfo.Compact:
      return <ArgumentDataEntry dataEntryAtom={dataEntryAtom} />
      
    case TypeDefInfo.Enum:
      return <EnumTypeDataEntry dataEntryAtom={dataEntryAtom} />

    case TypeDefInfo.Option:
      return <OptionTypeDataEntry dataEntryAtom={dataEntryAtom} />
    
    case TypeDefInfo.Struct:
      return <StructTypeDataEntry dataEntryAtom={dataEntryAtom} />
    
    case TypeDefInfo.Tuple:
      return <TupleOrVecFixedTypeDataEntry dataEntryAtom={dataEntryAtom} />

    case TypeDefInfo.VecFixed:
      return <TupleOrVecFixedTypeDataEntry dataEntryAtom={dataEntryAtom} />

    case TypeDefInfo.Vec:
      return <VecTypeDataEntry dataEntryAtom={dataEntryAtom} />
  
    default:
      return <OtherTypeDataEntry dataEntryAtom={dataEntryAtom} />
  }
})

const ArgumentForm = memo(({
  argAtom,
}: {
  argAtom: ArgAtom
}) => {
  const arg = useAtomValue(argAtom)
  const { abiParam, displayName, displayType, rootDataEntryAtom } = arg

  debug('[Each] ArgumentForm render', arg)

  return (
    <FormControl>
      <FormLabel>
        {displayName}
        <code tw="ml-2 text-xs text-gray-500 font-mono">{displayType}</code>
      </FormLabel>
      <ArgumentDataEntry dataEntryAtom={rootDataEntryAtom} />
    </FormControl>
  )
})

const ArgumentsForm = memo(() => {
  const currentArgsForm = useAtomValue(currentArgsFormAtom)
  const { args } = currentArgsForm

  debug('[Total] ArgumentsForm render', currentArgsForm)

  return (
    <Stack spacing="16px">
      {
        args.map((argAtom, index) => (
          <ArgumentForm
            key={index}
            argAtom={argAtom}
          />
        ))
      }
    </Stack>
  )
})

export default ArgumentsForm