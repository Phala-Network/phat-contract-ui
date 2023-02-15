import { AbiParam } from '@polkadot/api-contract/types'
import { TypeDefInfo } from '@polkadot/types'
import { Registry, TypeDef } from '@polkadot/types/types'
import { BN } from 'bn.js'
import { z } from 'zod'
import * as R from 'ramda'

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
}

export interface ValidateInfo<T extends unknown> {
  // Parsed value
  value?: T
  // Validate errors
  errors?: string[]
}

export const isNumberLikeType = (type: PlainType) => [
  PlainType.I8, PlainType.I32, PlainType.I64, PlainType.I128,
  PlainType.U8, PlainType.U32, PlainType.U64, PlainType.U128,
  PlainType.BN,
].includes(type)

export const isBoolType = (type: PlainType) => type === PlainType.Bool

const numberToBN = (value: unknown) => {
  if (typeof value === 'string') {
    const isNumberLike = /^(\-|\+)?\d+(\.\d*)?$/.test(value)
    if (isNumberLike) {
      return new BN(value)
    }
  } else if (typeof value === 'number') {
    try {
      const number = z.number().parse(value)
      return new BN(number)
    } catch (error) {
      return null
    }
  }

  return null
}

// Falsy value: '', '0', '00', '0x00', 'false', 'False', 'FALSE', ...
const stringToBoolean = (value: string): boolean => {
  const valueLowercase = value.toLocaleLowerCase()
  const numberValue = Number(valueLowercase)
  return numberValue === 0 || ['false'].includes(valueLowercase)
}

// No variant params: enum X { A, B }, input `A`, `["A"]` is OK
// Variant params: enum X { A(String) }, input `{ "A": "2" }` is OK
// Output: { "A": ... | undefined }
const objectToEnum = (value: unknown): Record<string, unknown> => {
  if (Array.isArray(value) && value.length === 1) {
    return { [value[0]]: undefined }
  } else if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value)
    if (keys.length === 1) {
      const name = keys[0]
      const subValue = (value as Record<string, unknown>)[name]
      return { [name]: subValue }
    }
  }

  return {}
}
const stringToEnum = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try {
      const object = JSON.parse(value)
      return objectToEnum(object)
    } catch (error) {
      return { [value]: undefined }
    }
  } else {
    return objectToEnum(value)
  }
}

// Return an array
const stringToArray = (value: unknown): unknown[] => {
  // E.g. '[1, 2, 3]', '1111'
  if (typeof value === 'string') {
    try {
      const object = JSON.parse(value)
      if (Array.isArray(object)) {
        return object
      }
    } catch (error) {
      return [value]
    }
  } else if (Array.isArray(value)) {
    return value
  }

  return []
}

const subToArray = (sub: TypeDef | TypeDef[]): TypeDef[] => {
  const subArray = Array.isArray(sub) ? sub : [sub]
  return subArray
}

// Transform, validate, and parse.
export const singleInputValidator = (
  registry: Registry,
  typeDef: TypeDef,
  inputValue: unknown,
  label?: string,
): ValidateInfo<unknown> => {
  const { info, type, sub, name, length } = typeDef

  try {
    if (info === TypeDefInfo.Plain) {
      if (isNumberLikeType(type as PlainType)) {
        const value = numberToBN(inputValue)
        if (value) {
          const isUnsignedNumber = type.startsWith('u')
          const isGteZero = value.gte(new BN(0))
          if (!isUnsignedNumber || isGteZero) {
            return {
              value,
            }
          } else {
            return {
              errors: [`The value ${label ? `${label}: ` : ''}${inputValue} must be >= 0.`]
            }
          }
        } else {
          return {
            errors: [`The type of the value ${label ? `${label}: ` : ''}${inputValue} is invalid.`]
          }
        }
      } else if (isBoolType(type as PlainType)) {
        try {
          const value$1 = String(inputValue)
          const value$2 = stringToBoolean(value$1)
          return {
            value: value$2
          }
        } catch (error) {
          return {
            errors: [`The type of the value ${label ? `${label}: ` : ''}${inputValue} is invalid.`]
          }
        }
      }
  
      // TODO: Balance, Address, AccountId

      try {
        const value = String(inputValue)
        return {
          value
        }
      } catch (error) {
        return {
          errors: [`The type of the value value ${label ? `${label}: ` : ''}${inputValue} is invalid.`]
        }
      }
    } else if (info === TypeDefInfo.Compact) {
      // Compact<T> type
      return singleInputValidator(registry, sub as TypeDef, inputValue)
    } else if (info === TypeDefInfo.Enum) {
      if (!sub) {
        throw new Error('Cannot retrieve sub array for type definition')
      } else {
        const variants = sub as TypeDef[]
        const inputFormatted = stringToEnum(inputValue)
        const variantNames = Object.keys(inputFormatted)

        if (variantNames.length) {
          const variantName = variantNames[0]
          const targetVariant = variants.find(variant => variant.name === variantName)
          if (targetVariant) {
            const variantValue = inputFormatted[variantName]
            const subValidateInfo = singleInputValidator(registry, targetVariant, variantValue, variantName)
            return {
              value: { [variantName]: subValidateInfo.value },
              errors: subValidateInfo.errors,
            }
          } else {
            return {
              errors: [`The value ${inputValue} of the Enum type is not exist.`]
            }
          }
        } else {
          return {
            errors: [`The type of the value ${inputValue} is invalid.`]
          }
        }
      }
    } else if (info === TypeDefInfo.Option) {
      if (inputValue) {
        return singleInputValidator(registry, sub as TypeDef, inputValue)
      } else {
        return {}
      }
    } else if (info === TypeDefInfo.Si) {
      return singleInputValidator(registry, registry.lookup.getTypeDef(type), inputValue)
    } else if (info === TypeDefInfo.Struct) {
      if (!sub) {
        throw new Error('Cannot retrieve sub array for type definition')
      } else {
        try {
          const subArray = subToArray(sub)
          const struct = JSON.parse(inputValue as string)
          const initInfo: ValidateInfo<Record<string, unknown>> = { value: {}, errors: [] }
          const validateInfo = R.reduce((info, subItem) => {
            const { name = '' } = subItem
            const subValue = R.path([name], struct)
            const subValidateInfo = singleInputValidator(registry, subItem, subValue, name)
            return {
              value: {
                ...(info?.value || {}),
                [name]: subValidateInfo.value,
              },
              errors: [
                ...(info?.errors || []),
                ...(subValidateInfo.errors || [])
              ]
            }
          }, initInfo, subArray)
          
          return validateInfo
        } catch (error) {
          return {
            errors: ['The value format must be validate JSON.']
          }
        }
      }
    } else if (
      info === TypeDefInfo.VecFixed ||
      info === TypeDefInfo.Vec
    ) {
      if (!sub) {
        throw new Error('Cannot retrieve sub array for type definition')
      }
      const inputParsed = stringToArray(inputValue)
      if (inputParsed.length) {
        if (info === TypeDefInfo.VecFixed) {
          if (inputParsed.length !== length) {
            return {
              errors: ['The value\'s length is invalid.']
            }
          }
        }

        const initInfo: ValidateInfo<unknown[]> = { value: [], errors: [] }
        const validateInfo = R.reduce((info, inputItem) => {
          const subValidateInfo = singleInputValidator(registry, sub as TypeDef, inputItem)
          return {
            value: [
              ...(info.value || []),
              subValidateInfo.value,
            ],
            errors: [
              ...(info.errors || []),
              ...(subValidateInfo.errors || []),
            ],
          }
        }, initInfo, inputParsed)

        return validateInfo
      } else {
        return {
          errors: [`The type of the value ${inputValue} is invalid.`]
        }
      }
    }
  } catch (error) {
    return {
      errors: ['Validate process Error.']
    }
  }

  // No process default
  return {
    value: inputValue,
  }
}

export const singleInputsValidator = (
  registry: Registry,
  args: AbiParam[],
  inputs: Record<string, unknown>
): ValidateInfo<unknown>[] => {
  const validateInfos = args.map(arg => {
    const { name, type } = arg
    const inputValue = inputs[name]
    return singleInputValidator(registry, type, inputValue)
  })

  return validateInfos
}