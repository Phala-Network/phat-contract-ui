import { camelizeKeys } from 'humps'
import { AbiParam } from '@polkadot/api-contract/types'
import { TypeDefInfo } from '@polkadot/types'
import { Registry, TypeDef } from '@polkadot/types/types'
import { BN } from 'bn.js'
import { z } from 'zod'
import * as R from 'ramda'

/**
 * -----------------------------------------------------------
 *                        Constants
 * -----------------------------------------------------------
 */

const INFOS_MUST_HAVE_SUB = [
  TypeDefInfo.Enum, TypeDefInfo.Struct,
  TypeDefInfo.Vec, TypeDefInfo.VecFixed, 
  TypeDefInfo.Tuple,
]

// Convert input value to string and add `...` if too long
export const ELLIPSIS_LENGTH = 20

/**
 * -----------------------------------------------------------
 *                      Type definitions
 * -----------------------------------------------------------
 */

// Argument's type when `type.info` is `TypeDefInfo.Plain`
export enum PlainType {
  // Signed number
  I8 = 'i8',
  I32 = 'i32',
  I64 = 'i64',
  I128 = 'i128',
  // Unsigned number
  U8 = 'u8',
  U32 = 'u32',
  U64 = 'u64',
  U128 = 'u128',
  // Big Number
  BN = 'BN',
  // Bool
  Bool = 'bool',
  // Address
  AccountId = 'AccountId',
  Address = 'Address',
  Bytes = 'Bytes',
}

export interface ValidateInfo<T> {
  // Parsed value
  value: T | undefined
  // Validate errors
  errors: string[]
}

/**
 * -----------------------------------------------------------
 *                 Arguments Type checkers
 * -----------------------------------------------------------
 */

export const isNumberLikeType = (type: PlainType) => [
  PlainType.I8, PlainType.I32, PlainType.I64, PlainType.I128,
  PlainType.U8, PlainType.U32, PlainType.U64, PlainType.U128,
  PlainType.BN,
].includes(type)

export const isBoolType = (type: PlainType) => type === PlainType.Bool
export const isAddressType = (type: PlainType) => [
  PlainType.AccountId, PlainType.Address,
].includes(type)

/**
 * -----------------------------------------------------------
 *                    Type conversions
 * -----------------------------------------------------------
 */

const toString = (value: unknown): string => {
  if (R.is(String, value)) {
    return value
  } else {
    return R.toString(value)
  }
}

// Convert a string or number like a number to a Big Number,
// It doesn't contain NaN, Infinity
export const convertToBN = (value: string | number) => {
  if (R.is(String, value) && value !== '') {
    const number = Number(value)
    if (Number.isFinite(number)) {
      return new BN(number)
    }
  } else if (R.is(Number, value)) {
    try {
      // Filter out NaN, Finite
      const number = z.number().finite().parse(value)
      return new BN(number)
    } catch (error) {
      return null
    }
  }

  return null
}

// Falsy value: '', '0', '00', '0x00', 'false', 'False', and 'FALSE', etc.
const convertToBoolean = (value: string): boolean => {
  const valueLowercase = value.toLocaleLowerCase()
  const numberValue = Number(valueLowercase)
  return numberValue === 0 || ['false'].includes(valueLowercase)
}

// No variant params: enum X { A, B }, input `A`, `["A"]` is OK
// Variant params: enum X { A(String) }, input `{ "A": "2" }` is OK
// Output: { "A": ... | undefined }
export const objectToEnum = (value: Record<string, unknown>): Record<string, unknown> => {
  // ["A"] is OK, [{ "A": '' }] is Failed, ["A", "B"] is Failed.
  if (Array.isArray(value) && value.length === 1 && R.is(String, value[0])) {
    return { [value[0]]: null }
  } else if (R.is(Object, value)) {
    const keys = Object.keys(value)
    // { A: 1 } is OK, { A: 1, B: 2 } is Failed
    if (keys.length === 1) {
      const name = keys[0]
      const subValue = (value as Record<string, unknown>)[name]
      return { [name]: subValue }
    }
  }

  return {}
}

// Return `{}` is represent invalid.
export const convertToEnum = (value: unknown): Record<string, unknown> => {
  if (R.is(String, value)) {
    try {
      const parsedValue = JSON.parse(value)
      if (R.is(Object, parsedValue)) {
        return objectToEnum(parsedValue)
      } else {
        return { [value]: null }
      }
    } catch (error) {
      return { [value]: null }
    }
  } else if (R.is(Object, value)) {
    return objectToEnum(value)
  } else {
    return {}
  }
}

// Return an array
const convertToArray = (value: unknown): unknown[] => {
  // E.g. '[1, 2, 3]', '1111'
  if (R.is(String, value)) {
    try {
      const parsedValue = JSON.parse(value)
      if (Array.isArray(parsedValue)) {
        return parsedValue
      } else {
        return [value]
      }
    } catch (error) {
      return [value]
    }
  } else if (R.is(Number, value)) {
    return [value]
  } else if (Array.isArray(value)) {
    return value
  }

  return []
}

export const subToArray = (sub?: TypeDef | TypeDef[]): TypeDef[] => {
  if (!sub) {
    return []
  }
  const subArray = Array.isArray(sub) ? sub : [sub]
  return subArray
}

/**
 * -----------------------------------------------------------
 *                     Error generations
 * -----------------------------------------------------------
 */

// Create a union error message.
const createErrors = (...errors: string[]): ValidateInfo<undefined> => ({
  value: undefined,
  errors: [errors.join('')]
})

// InputValue's type is invalid.
export const inputTypeInvalidMessage = (inputValue: unknown, validTypes: string[]) => createErrors(
  `The type of the value ${formatInput(inputValue)} is invalid. `,
  `Please give a value of ${validTypes.join(' or ')} type.`,
)
// InputValue must have a value.
export const inputCantBeEmpty = () => createErrors(
  'The value is empty. ',
  'Please input a valid value.'
)
// InputValue is not a valid JSON
export const inputNotValidJSON = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} is an invalid JSON. `,
  'Please check the value.'
)
// Number-like value
export const cantToNumberMessage = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} can not convert to a number. `,
  `Please give a value like '123', '0x10', or 123, etc.`
)
export const unsignedNumberEteZero = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} must be a number >= 0.`
)
// Enum value
export const enumInvalidMessage = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} is invalid. `,
  'Please give a value that format is `variantName`, `["variantName"]`, or `{ "variantName": <variantValue> }`',
  "Whether string, array or object depends on Enum variant has params."
)
export const enumVariantParamsMessage = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} is invalid. `,
  'This Enum variant must have a param. ',
  'Please give a value that format is `{ "variantName": <variantValue> }`'
)
export const enumVariantWithoutParamsMessage = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} is invalid. `,
  'This Enum variant must have no any param. ',
  'Please give a value that format is `variantName`, or `["variantName"]`.'
)
export const enumVariantNotExistMessage = (name: string, variantNames: string[]) => createErrors(
  `The variant named ${name} is not the variant of this Enum. `,
  `The variants contains ${variantNames.join(', ')}.`
)
// VecFixed value
export const vecFixedLengthInvalidMessage = (inputValue: unknown) => createErrors(
  `The length of the value ${formatInput(inputValue)} is invalid. `,
  'Please check the value'
)
// VecFixed, Vec
export const vecOrTupleInvalidMessage = (inputValue: unknown) => createErrors(
  `The value ${formatInput(inputValue)} is invalid. `,
  'Please give an array value.',
)
// Struct
export const structKeyNotExistMessage = (notExistKeys: string[]) => createErrors(
  `The struct misses follow keys: ${notExistKeys.join(', ')}`
)

/**
 * -----------------------------------------------------------
 *                     Value generations
 * -----------------------------------------------------------
 */

// Create a validateInfo without errors.
const createValueInfo = <T>(value: T) => ({
  value,
  errors: []
})

/**
 * -----------------------------------------------------------
 *                    Input processor
 * -----------------------------------------------------------
 */

// Convert input value to string and add `...` if too long
export const formatInput = (inputValue: unknown) => {
  const value = toString(inputValue)
  const length = value.length

  if (length > ELLIPSIS_LENGTH) {
    return value.substring(0, length) + '...'
  } else {
    return value
  }
}

/**
 * -----------------------------------------------------------
 *                       Validators
 * -----------------------------------------------------------
 */

// Follow types must have sub value
export const validateSub = (typeDef: TypeDef) => {
  const { info, sub } = typeDef

  if (R.includes(info, INFOS_MUST_HAVE_SUB) && !sub) {
    throw new Error('Cannot retrieve sub array for type definition, please check the contract file.')
  }
}

// Plain only allows the type is string (!== ''), number.
export const validatePlainInput = (inputValue: unknown) => {
  if (!R.is(String, inputValue) && !R.is(Number, inputValue)) {
    return inputTypeInvalidMessage(inputValue, ['String', 'Number'])
  } else if (inputValue === '') {
    return inputCantBeEmpty()
  }
}

// Make sure the input value is a number-like value and convert to big number.
export const validateNumberLikeType = (typeDef: TypeDef, inputValue: string | number) => {
  const { type } = typeDef
  const value = convertToBN(inputValue)
  if (value) {
    const isUnsignedNumber = type.startsWith('u')
    const isGteZero = value.gte(new BN(0))
    // The number of u8, u32, u64, ... must be >= 0
    if (!isUnsignedNumber || isGteZero) {
      return createValueInfo(value)
    } else {
      return unsignedNumberEteZero(inputValue)
    }
  } else {
    return cantToNumberMessage(inputValue)
  }
}

// Make sure the input value is a truthy value, and convert to boolean type.
export const validateBoolType = (_: TypeDef, inputValue: string | number) => {
  try {
    const value$1 = String(inputValue)
    const value$2 = convertToBoolean(value$1)
    return createValueInfo(value$2)
  } catch (error) {
    return inputTypeInvalidMessage(inputValue, ['String', 'Number', 'Boolean'])
  }
}

// Plain type value's validation
export const validatePlainType = (typeDef: TypeDef, inputValue: unknown): ValidateInfo<unknown> => {
  const { type } = typeDef

  // Plain only allows the type is string, number
  const inputValidateInfo = validatePlainInput(inputValue)
  if (inputValidateInfo) {
    return inputValidateInfo
  }

  // Confirm input value's type
  const inputValue$1 = inputValue as string | number

  if (isNumberLikeType(type as PlainType)) {
    return validateNumberLikeType(typeDef, inputValue$1)
  } else if (isBoolType(type as PlainType)) {
    return validateBoolType(typeDef, inputValue$1)
  }

  // TODO: Balance, Address, AccountId

  // Other type receives a String value
  const value = toString(inputValue$1)
  return createValueInfo(value)
}

// Plain only allows the type is string (!== ''), object (!== {}).
export const validateEnumInput = (inputValue: unknown) => {
// Enum value only allow String, Object
  // String is like 'A', '["A"]', '{ "A": 1 }', etc.
  // Object is like { A: 1 }, ["A"], etc.
  // Number is complex, so don't support now.
  if (!R.either(R.is(String), R.is(Object))(inputValue)) {
    return inputTypeInvalidMessage(inputValue, ['String', 'Object'])
  } else if (R.isEmpty(inputValue)) {
    // Can't give '' or {}
    return inputCantBeEmpty()
  }
}

// Make sure the input value is a valid Enum, and convert to object.
export const validateEnumType = (registry: Registry, typeDef: TypeDef, inputValue: unknown) => {
  const { sub } = typeDef
  const inputValidateInfo = validateEnumInput(inputValue)
  if (inputValidateInfo) {
    return inputValidateInfo
  }

  const inputValue$1 = inputValue as string | Record<string, unknown>

  const variants = sub as TypeDef[]
  // The value is `{}` or `{ A: <unknown> }`
  const inputFormatted = convertToEnum(inputValue$1)
  const variantNames = Object.keys(inputFormatted)

  if (variantNames.length) {
    const variantName = variantNames[0]
    const variantValue = inputFormatted[variantName]
    const targetVariant = variants.find(variant => variant.name === variantName)

    if (targetVariant) {
      if (targetVariant.type === 'Null') {
        if (variantValue !== null) {
          return enumVariantWithoutParamsMessage(inputValue)
        }

        return createValueInfo({
          [variantName]: null,
        })
      } else {
        if (variantValue === null) {
          return enumVariantParamsMessage(inputValue)
        }

        const subValidateInfo = singleInputValidator(registry, targetVariant, variantValue)
        return {
          value: { [variantName]: subValidateInfo.value },
          errors: subValidateInfo.errors,
        }
      }
    } else {
      return enumVariantNotExistMessage(
        variantName,
        variants.map(_ => (_.name || '')).filter(_ => _),
      )
    }
  } else {
    return enumInvalidMessage(inputValue)
  }
}

export const validateStructInput = (inputValue: unknown) => {
  // Struct value only allow String, Object
  // String is JSON like '{ "A": 1 }', etc.
  // Object is like { A: 1 }, etc.
  if (!R.either(R.is(String), R.is(Object))(inputValue)) {
    return inputTypeInvalidMessage(inputValue, ['String', 'Object'])
  } else if (R.isEmpty(inputValue)) {
    return inputCantBeEmpty()
  }
}

// Make sure the input value is a valid value, and can convert to object.
export const validateStructType = (registry: Registry, typeDef: TypeDef, inputValue: unknown) => {
  const { sub } = typeDef

  const inputValidateInfo = validateStructInput(inputValue)
  if (inputValidateInfo) {
    return inputValidateInfo
  }

  const inputValue$1 = inputValue as string | Record<string, unknown>

  let struct = {}
  const subArray = subToArray(sub as TypeDef | TypeDef[])

  // Try to parse to a object.
  if (R.is(String, inputValue$1)) {
    try {
      const parsedValue = JSON.parse(inputValue$1 as string)

      if (R.is(Object, parsedValue)) {
        struct = parsedValue
      } else {
        return inputNotValidJSON(inputValue$1)
      }
    } catch (error) {
      return inputNotValidJSON(inputValue$1)
    }
  } else {
    struct = inputValue$1
  }

  const keys = Object.keys(struct)
  const notExistSubItems = subArray.filter((subItem) => {
    return keys.findIndex(key => subItem.name === key) === -1
  })

  if (notExistSubItems.length) {
    return structKeyNotExistMessage(notExistSubItems.map(subItem => subItem.name || '').filter(_ => _))
  }

  // Recursion and build sub value.
  const initInfo: ValidateInfo<Record<string, unknown>> = { value: {}, errors: [] }
  const validateInfo = R.reduce((info, subItem) => {
    const { name = '' } = subItem
    const subValue = R.path([name], struct)
    const subValidateInfo = singleInputValidator(registry, subItem, subValue)
    return {
      value: {
        ...(info?.value || {}),
        [name]: subValidateInfo.value,
      },
      errors: R.uniq([
        ...(info?.errors || []),
        ...(subValidateInfo.errors || [])
      ])
    }
  }, initInfo, subArray)
  
  return validateInfo
}

// Tuple allow Number, String, Array
// Tuple = (0), it can receive 0, "0", [0], ["0"], "[0]", "["0"]"
// Tuple = (Option<u32>), it can receive 1, 0, [1], [0], "[1]", "[0]", '', [null], "[null]"
export const validateTupleInput = (inputValue: unknown) => {
  if (
    !R.is(Number, inputValue) &&
    !R.is(String, inputValue) &&
    !Array.isArray(inputValue)
  ) {
    return inputTypeInvalidMessage(inputValue, ['Number', 'String', 'Array'])
  }
}

// Make sure the input value is a valid value, and can convert to array.
export const validateTupleType = (registry: Registry, typeDef: TypeDef, inputValue: unknown) => {
  const { sub } = typeDef

  const inputValidateInfo = validateTupleInput(inputValue)
  if (inputValidateInfo) {
    return inputValidateInfo
  }

  const subArray = subToArray(sub as TypeDef | TypeDef[])
  const inputParsed = convertToArray(inputValue)

  if (inputParsed.length) {
    const subLength = subArray.length
    if (inputParsed.length !== subLength) {
      return vecFixedLengthInvalidMessage(inputParsed)
    }

    // Recursion and build sub value.
    const initInfo: ValidateInfo<unknown[]> = { value: [], errors: [] }
    const validateInfo = subArray.reduce((info, subItem, index) => {
      const inputItem = inputParsed[index]
      const subValidateInfo = singleInputValidator(registry, subItem, inputItem)
      return {
        value: [
          ...(info.value || []),
          subValidateInfo.value,
        ].filter(_ => _ !== undefined),
        errors: R.uniq([
          ...(info.errors || []),
          ...(subValidateInfo.errors || []),
        ]),
      }
    }, initInfo)

    return validateInfo
  } else if (inputValue === '' && subArray.length === 1 && subArray[0].info === TypeDefInfo.Option) {
    return createValueInfo([null])
  } else {
    return vecOrTupleInvalidMessage(inputValue)
  }
}

// VecFixed and Vec value only allow String, Object
// String is JSON like '[ "A" ]', etc.
// Object is like [ "A" ], etc.
// Number is complex, so don't support now. 
export const validateVecOrVecFixedInput = (inputValue: unknown) => {
  if (!R.either(R.is(String), R.is(Object))(inputValue)) {
    return inputTypeInvalidMessage(inputValue, ['String', 'Object'])
  } else if (inputValue === '') {
    return inputCantBeEmpty()
  }
}

// Make sure the input value is a valid value, and can convert to array.
export const validateVecOrVecFixedType = (registry: Registry, typeDef: TypeDef, inputValue: unknown) => {
  const { info, sub, length } = typeDef

  const inputValidateInfo = validateVecOrVecFixedInput(inputValue)
  if (inputValidateInfo) {
    return inputValidateInfo
  }

  const inputValue$1 = inputValue as string | Record<string, unknown>
  const inputParsed = convertToArray(inputValue$1)

  if (inputParsed.length) {
    // The length of VecFixed type is invalid.
    if (info === TypeDefInfo.VecFixed) {
      if (inputParsed.length !== length) {
        return vecFixedLengthInvalidMessage(inputValue)
      }
    }

    // Recursion and build sub value.
    const initInfo: ValidateInfo<unknown[]> = { value: [], errors: [] }
    const validateInfo = R.reduce((info, inputItem) => {
      const subValidateInfo = singleInputValidator(registry, sub as TypeDef, inputItem)
      return {
        value: [
          ...(info.value || []),
          subValidateInfo.value,
        ].filter(_ => _ !== undefined),
        errors: R.uniq([
          ...(info.errors || []),
          ...(subValidateInfo.errors || []),
        ]),
      }
    }, initInfo, inputParsed)

    return validateInfo
  } else {
    return vecOrTupleInvalidMessage(inputValue)
  }
}

// Transform, validate, and parse.
// Throw error when contract file has problem or unexpected errors.
export const singleInputValidator = (
  registry: Registry,
  typeDef: TypeDef,
  inputValue: unknown,
): ValidateInfo<unknown> => {
  const { info, type, sub } = typeDef

  // Follow types must have sub value
  validateSub(typeDef)

  try {
    switch (info) {
      case TypeDefInfo.Plain:
        return validatePlainType(typeDef, inputValue)

      case TypeDefInfo.Compact:
        // Compact<T> type
        return singleInputValidator(registry, sub as TypeDef, inputValue)

      case TypeDefInfo.Enum:
        return validateEnumType(registry, typeDef, inputValue)

      case TypeDefInfo.Option: {
        if (inputValue) {
          return singleInputValidator(registry, sub as TypeDef, inputValue)
        } else {
          return createValueInfo(null)
        }
      }

      case TypeDefInfo.Si:
        type getTypeDefArgs = Parameters<typeof registry.lookup.getTypeDef>
        return singleInputValidator(registry, registry.lookup.getTypeDef(type as getTypeDefArgs[0]), inputValue)

      case TypeDefInfo.Struct:
        return validateStructType(registry, typeDef, inputValue)

      case TypeDefInfo.Tuple:
        return validateTupleType(registry, typeDef, inputValue)

      case TypeDefInfo.VecFixed:
      case TypeDefInfo.Vec:
        return validateVecOrVecFixedType(registry, typeDef, inputValue)

    
      default:
        break;
    }
  } catch (error) {
    throw new Error(`Validate process error: ${toString(error)}`)
  }

  // No process default
  return createValueInfo(inputValue)
}

export const singleInputsValidator = (
  registry: Registry,
  args: AbiParam[],
  inputs: Record<string, unknown>
): ValidateInfo<unknown>[] => {
  const validateInfos = args.map(arg => {
    const { name, type } = arg
    const camelizeInputs = camelizeKeys(inputs) as Record<string, unknown>
    const inputValue = camelizeInputs[name]
    return singleInputValidator(registry, type, inputValue)
  })

  return validateInfos
}

/**
 * -------------------------------
 *         Form validators
 * -------------------------------
 */

// The form will ensure that either there is a valid value or it is undefined.
export const validateNotUndefined = (value: unknown): string[] => {
  if (value === undefined) {
    return ['The value mustn\'t be empty.']
  }
  return []
}