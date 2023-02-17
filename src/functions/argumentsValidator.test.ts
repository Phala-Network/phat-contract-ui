import { Abi } from '@polkadot/api-contract'
import { BN } from 'bn.js'
import metadata from '../abis/system.json'
import {
  inputTypeInvalidMessage,
  singleInputsValidator,
  inputCantBeEmpty,
  vecInvalidMessage,
  vecFixedLengthInvalidMessage,
  cantToNumberMessage,
  unsignedNumberEteZero,
  singleInputValidator,
  ValidateInfo,
  enumVariantNotExistMessage,
  enumVariantWithoutParamsMessage,
} from './argumentsValidator'

// Missing test:
// - Option
// - Compact
// - Si
// - Struct
// - Vec
// - Enum (Variant with params)

// Prepare the arguments data.
// This metadata can test:
// - u32, u64, Text, AccountId, Balance (The part of Plain type)
// - Enum (Variant without params)
// - VecFixed
const abi = new Abi(JSON.stringify(metadata))
/**
 * It contains 13 messages, all messages' arguments are following:
 * 
 * [
 *   // <Empty Arguments>
 *   // Message index = 0, the arguments are:
 *   [],
 *   // <AccountId>
 *   // Message index = 1, the arguments are:
 *   [
 *     { "name": 'contractId', "type": "AccountId" }
 *   ],
 *   // <Text, AccountId>
 *   // Message index = 2, the arguments are:
 *   [
 *     { "name": "name", "type": "Text" },
 *     { "name": "contractId", "type": "AccountId" }
 *   ],
 *   // <Text>
 *   // Message index = 3, the arguments are:
 *   [
 *      { "name": "name", "type": "Text" },
 *   ],
 *   // <AccountId, VecFixed<u8>>
 *   // Message index = 4, the arguments are:
 *   [
 *      { "name": "contractId", "type": "AccountId" },
 *      { "name": "codeHash", "type": "[u8; 32]" }
 *   ],
 *   // <AccountId>
 *   // Message index = 5, the arguments are:
 *   [
 *     { name: 'contractId', type: 'AccountId' }
 *   ],
 *   // <Enum, AccountId, u32, u64>
 *   // Message index = 6, the arguments are:
 *   [
 *     { name: 'hook', type: '{"_enum":["OnBlockEnd"]}' },
 *     { name: 'contract', type: 'AccountId' },
 *     { name: 'selector', type: 'u32' },
 *     { name: 'gasLimit', type: 'u64' }
 *   ],
 *   // <AccountId, u32>
 *   // Message index = 7, the arguments are:
 *   [
 *     { name: 'contractId', type: 'AccountId' },
 *     { name: 'weight', type: 'u32' }
 *   ],
 *   // <AccountId>
 *   // Message index = 8, the arguments are:
 *   [
 *     { name: 'account', type: 'AccountId' }
 *   ],
 *   // <AccountId>
 *   // Message index = 9, the arguments are:
 *   [
 *     { name: 'account', type: 'AccountId' }
 *   ],
 *   // <AccountId>
 *   // Message index = 10, the arguments are:
 *   [
 *     { name: 'contractId', type: 'AccountId' }
 *   ],
 *   // <Empty Arguments>
 *   // Message index = 11, the arguments are:
 *   [],
 *   // <AccountId, Balance>
 *   // Message index = 12, the arguments are:
 *   [
 *     { name: 'contractId', type: 'AccountId' },
 *     { name: 'deposit', type: 'Balance' }
 *   ]
 * ]
 * 
 * The type test and message index map are following:
 * u32 - 6
 * u64 - 6
 * Text - 3
 * AccountId - 6
 * Balance - 12
 * Enum - 6
 * VecFixed - 4
 */
const messages = abi.messages
const registry = abi.registry

const multiArguments = messages[6].args
const enumArgumentTypeDef = multiArguments[0].type
const accountIdArgumentTypeDef = multiArguments[1].type
const u32ArgumentTypeDef = multiArguments[2].type
const u64ArgumentTypeDef = multiArguments[3].type

const textArgumentTypeDef = messages[3].args[0].type
const balanceArgumentTypeDef = messages[12].args[1].type
const vecFixedArgumentTypeDef = messages[4].args[1].type

const numberValue: number = 123
const numberValueEmpty: number = 0
const stringValue: string = 'hello world'
const stringValueEmpty: string = ''
const stringValueZero: string = '0'
const booleanValue: boolean = true
const booleanValueFalse: boolean = false
const objectValue: object = { 'key': 'value' }
const objectValueEmpty: object = {}
const arrayValue: unknown[] = [1, 'two', true, {}]
const arrayValueEmpty: unknown[] = []
const nullValue: null = null

/**
 * The user input value is a string, but the string may be a JSON,
 * which can be parsed to an object, so all the basic types of JSON will be received by the singleInputValidator.
 * It contains `string`, `number`, `boolean`, `null`
 */
describe('Tests of the function named singleInputValidator', () => {

  describe('Tests for the Plain type', () => {

    describe('Tests for the u32 type', () => {

      // Only receive 123, 0, '0', reject -1, '', 'abc', '-1', null, boolean, object(array)
      // Remember: it return a big number.

      test('should receive a normal number', () => {
        const numberValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, numberValue)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: new BN(numberValue),
          errors: [],
        }

        expect(numberValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive an empty number', () => {
        const numberEmptyValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, numberValueEmpty)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: new BN(numberValueEmpty),
          errors: [],
        }

        expect(numberEmptyValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive a normal number string', () => {
        const stringValueZeroValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, stringValueZero)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: new BN(0),
          errors: [],
        }

        expect(stringValueZeroValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject an empty string', () => {
        const stringValueEmptyValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, stringValueEmpty)
        const expectValidateInfo: ValidateInfo<unknown> = inputCantBeEmpty()

        expect(stringValueEmptyValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject a not number string', () => {
        const stringValueValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, stringValue)
        const expectValidateInfo: ValidateInfo<unknown> = cantToNumberMessage(stringValue)

        expect(stringValueValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject a negative number', () => {
        const negativeNumber = -1
        const negativeNumberValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, negativeNumber)
        const expectValidateInfo: ValidateInfo<unknown> = unsignedNumberEteZero(negativeNumber)

        expect(negativeNumberValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject a negative number string', () => {
        const negativeNumberString = '-1'
        const negativeNumberStringValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, negativeNumberString)
        const expectValidateInfo: ValidateInfo<unknown> = unsignedNumberEteZero(negativeNumberString)

        expect(negativeNumberStringValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject null, boolean, or object type value', () => {
        const acceptTypes = ['String', 'Number']

        const nullValueValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, nullValue)
        const expectNullValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(nullValue, acceptTypes)
        const booleanValueValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, booleanValue)
        const expectBooleanValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(booleanValue, acceptTypes)
        const booleanValueFalseValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, booleanValueFalse)
        const expectBooleanValueFalseValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(booleanValueFalse, acceptTypes)
        const objectValueValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, objectValue)
        const expectObjectValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(objectValue, acceptTypes)
        const objectValueEmptyValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, objectValueEmpty)
        const expectObjectValueEmptyValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(objectValueEmpty, acceptTypes)
        const arrayValueValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, arrayValue)
        const expectArrayValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(arrayValue, acceptTypes)
        const arrayValueEmptyValidateInfo = singleInputValidator(registry, u32ArgumentTypeDef, arrayValueEmpty)
        const expectArrayValueEmptyValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(arrayValueEmpty, acceptTypes)

        expect(nullValueValidateInfo).toEqual(expectNullValueValidateInfo)
        expect(booleanValueValidateInfo).toEqual(expectBooleanValueValidateInfo)
        expect(booleanValueFalseValidateInfo).toEqual(expectBooleanValueFalseValidateInfo)
        expect(objectValueValidateInfo).toEqual(expectObjectValueValidateInfo)
        expect(objectValueEmptyValidateInfo).toEqual(expectObjectValueEmptyValidateInfo)
        expect(arrayValueValidateInfo).toEqual(expectArrayValueValidateInfo)
        expect(arrayValueEmptyValidateInfo).toEqual(expectArrayValueEmptyValidateInfo)
      })

    })

    describe('Tests for the AccountId type', () => {

      // Only receive 123, -1, 0, '0', '-1', 'abc', reject '', null, boolean, object(array)
      // It return the value converted to string.

      test('should receive a normal number', () => {
        const numberValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, numberValue)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: '' + numberValue,
          errors: [],
        }

        expect(numberValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive an empty number', () => {
        const numberEmptyValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, numberValueEmpty)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: '' + numberValueEmpty,
          errors: [],
        }

        expect(numberEmptyValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive a normal number string', () => {
        const stringValueZeroValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, stringValueZero)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: stringValueZero,
          errors: [],
        }

        expect(stringValueZeroValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive a not number string', () => {
        const stringValueValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, stringValue)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: stringValue,
          errors: [],
        }

        expect(stringValueValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive a negative number', () => {
        const negativeNumber = -1
        const negativeNumberValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, negativeNumber)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: '' + negativeNumber,
          errors: [],
        }

        expect(negativeNumberValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive a negative number string', () => {
        const negativeNumberString = '-1'
        const negativeNumberStringValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, negativeNumberString)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: negativeNumberString,
          errors: [],
        }

        expect(negativeNumberStringValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject an empty string', () => {
        const stringValueEmptyValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, stringValueEmpty)
        const expectValidateInfo: ValidateInfo<unknown> = inputCantBeEmpty()

        expect(stringValueEmptyValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject null, boolean, or object type value', () => {
        const acceptTypes = ['String', 'Number']

        const nullValueValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, nullValue)
        const expectNullValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(nullValue, acceptTypes)
        const booleanValueValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, booleanValue)
        const expectBooleanValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(booleanValue, acceptTypes)
        const booleanValueFalseValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, booleanValueFalse)
        const expectBooleanValueFalseValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(booleanValueFalse, acceptTypes)
        const objectValueValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, objectValue)
        const expectObjectValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(objectValue, acceptTypes)
        const objectValueEmptyValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, objectValueEmpty)
        const expectObjectValueEmptyValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(objectValueEmpty, acceptTypes)
        const arrayValueValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, arrayValue)
        const expectArrayValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(arrayValue, acceptTypes)
        const arrayValueEmptyValidateInfo = singleInputValidator(registry, accountIdArgumentTypeDef, arrayValueEmpty)
        const expectArrayValueEmptyValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(arrayValueEmpty, acceptTypes)

        expect(nullValueValidateInfo).toEqual(expectNullValueValidateInfo)
        expect(booleanValueValidateInfo).toEqual(expectBooleanValueValidateInfo)
        expect(booleanValueFalseValidateInfo).toEqual(expectBooleanValueFalseValidateInfo)
        expect(objectValueValidateInfo).toEqual(expectObjectValueValidateInfo)
        expect(objectValueEmptyValidateInfo).toEqual(expectObjectValueEmptyValidateInfo)
        expect(arrayValueValidateInfo).toEqual(expectArrayValueValidateInfo)
        expect(arrayValueEmptyValidateInfo).toEqual(expectArrayValueEmptyValidateInfo)
      })
    })
  })

  describe('Tests for the Enum type', () => {

    describe('Tests for the Enum type that the variant has no params', () => {

      // The Enum type value is {"_enum":["OnBlockEnd"]}' }
      // So only receive 'OnBlockEnd' or '{ "OnBlockEnd": undefined | null }' string or { "OnBlockEnd": undefined | null } object.
      // Remember return value is an object.

      test('should receive the string value which is in the Enum', () => {
        const variantValue = 'OnBlockEnd'
        const variantValueValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, variantValue)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: { [variantValue]: null },
          errors: []
        }

        expect(variantValueValidateInfo).toEqual(expectValidateInfo)
      })

      // Doesn't have `{ OnBlockEnd: undefined }` situation.
      test('should receive the object value which is matching to Enum variant', () => {
        const nullObject = { OnBlockEnd: null }
        const nullValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, nullObject)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: nullObject,
          errors: []
        }

        expect(nullValidateInfo).toEqual(expectValidateInfo)
      })

      test('should receive the JSON value which is matching to Enum variant', () => {
        const nullObject = { OnBlockEnd: null }
        const nullJSON = JSON.stringify(nullObject)
        const nullValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, nullJSON)
        const expectValidateInfo: ValidateInfo<unknown> = {
          value: nullObject,
          errors: []
        }

        expect(nullValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject the string value which is not in the Enum', () => {
        const notVariantValue = 'abc'
        const notVariantValueValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, notVariantValue)
        const expectValidateInfo: ValidateInfo<unknown> = enumVariantNotExistMessage(notVariantValue, ['OnBlockEnd'])

        expect(notVariantValueValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject an empty string', () => {
        const stringValueEmptyValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, stringValueEmpty)
        const expectValidateInfo: ValidateInfo<unknown> = inputCantBeEmpty()

        expect(stringValueEmptyValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject the string value which is not a JSON', () => {
        const nullNotJSON = '{{ OnBlockEnd: null }'
        const nullValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, nullNotJSON)
        const expectValidateInfo: ValidateInfo<unknown> = enumVariantNotExistMessage(nullNotJSON, ['OnBlockEnd'])

        expect(nullValidateInfo).toEqual(expectValidateInfo)
      })

      test('should reject the object value which is not matching to Enum variant', () => {
        const stringObject = { OnBlockEnd: stringValue }
        const stringEmptyObject = { OnBlockEnd: stringValueEmpty }
        const numberEmptyObject = { OnBlockEnd: numberValueEmpty }
        const booleanFalseObject = { OnBlockEnd: booleanValueFalse }
        const objectEmptyObject = { OnBlockEnd: objectValueEmpty }

        const stringObjectValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, stringObject)
        const expectStringObjectValidateInfo: ValidateInfo<unknown> = enumVariantWithoutParamsMessage(stringObject)
        const stringEmptyObjectValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, stringEmptyObject)
        const expectStringEmptyObjectValidateInfo: ValidateInfo<unknown> = enumVariantWithoutParamsMessage(stringEmptyObject)
        const numberEmptyObjectValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, numberEmptyObject)
        const expectNumberEmptyObjectValidateInfo: ValidateInfo<unknown> = enumVariantWithoutParamsMessage(numberEmptyObject)
        const booleanFalseObjectValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, booleanFalseObject)
        const expectBooleanFalseObjectValidateInfo: ValidateInfo<unknown> = enumVariantWithoutParamsMessage(booleanFalseObject)
        const objectEmptyObjectValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, objectEmptyObject)
        const expectObjectEmptyObjectValidateInfo: ValidateInfo<unknown> = enumVariantWithoutParamsMessage(objectEmptyObject)

        expect(stringObjectValidateInfo).toEqual(expectStringObjectValidateInfo)
        expect(stringEmptyObjectValidateInfo).toEqual(expectStringEmptyObjectValidateInfo)
        expect(numberEmptyObjectValidateInfo).toEqual(expectNumberEmptyObjectValidateInfo)
        expect(booleanFalseObjectValidateInfo).toEqual(expectBooleanFalseObjectValidateInfo)
        expect(objectEmptyObjectValidateInfo).toEqual(expectObjectEmptyObjectValidateInfo)
      })

      test('should reject number, null, or boolean type value', () => {
        const acceptTypes = ['String', 'Object']

        const numberValueValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, numberValue)
        const expectNumberValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(numberValue, acceptTypes)
        const nullValueValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, nullValue)
        const expectNullValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(nullValue, acceptTypes)
        const booleanValueValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, booleanValue)
        const expectBooleanValueValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(booleanValue, acceptTypes)
        const booleanValueFalseValidateInfo = singleInputValidator(registry, enumArgumentTypeDef, booleanValueFalse)
        const expectBooleanValueFalseValidateInfo: ValidateInfo<unknown> = inputTypeInvalidMessage(booleanValueFalse, acceptTypes)

        expect(numberValueValidateInfo).toEqual(expectNumberValueValidateInfo)
        expect(booleanValueValidateInfo).toEqual(expectBooleanValueValidateInfo)
        expect(booleanValueFalseValidateInfo).toEqual(expectBooleanValueFalseValidateInfo)
        expect(nullValueValidateInfo).toEqual(expectNullValueValidateInfo)
      })

    })

  })

})



describe('system meta data test suite', () => {

  test('should work well when message doesn\'t args', () => {
    const message = messages[0]
    // The args is `[]`.
    const args = message.args
    // The inputs is `{}`
    const inputs = {}
    const output = singleInputsValidator(registry, args, inputs)

    expect(output).toEqual([])
  })

  test('should work well when the type of arg is AccountId', () => {
    const message = messages[1]
    // `args` = [ { "name": 'contractId', "type": "AccountId" } ]
    const args = message.args
    const acceptTypes = ['String', 'Number']
    const inputs$1 = { contractId: 'a account example' }
    const inputs$2 = { contractId: 1234567890 }
    const inputs$3 = { contractId: 0 }
    const inputs$4 = { contractId: '' }
    const inputs$5 = { contractId: undefined }
    const inputs$6 = { contractId: null }
    const inputs$7 = { contractId: {} }
    const output$1 = singleInputsValidator(registry, args, inputs$1)
    const output$2 = singleInputsValidator(registry, args, inputs$2)
    const output$3 = singleInputsValidator(registry, args, inputs$3)
    const output$4 = singleInputsValidator(registry, args, inputs$4)
    const output$5 = singleInputsValidator(registry, args, inputs$5)
    const output$6 = singleInputsValidator(registry, args, inputs$6)
    const output$7 = singleInputsValidator(registry, args, inputs$7)

    expect(output$1).toEqual([{ value: 'a account example', errors: [] }])
    expect(output$2).toEqual([{ value: '1234567890', errors: [] }])
    expect(output$3).toEqual([{ value: '0', errors: [] }])
    expect(output$4).toEqual([{ value: undefined, errors: inputCantBeEmpty().errors }])
    expect(output$5).toEqual([{ value: undefined, errors: inputTypeInvalidMessage(undefined, acceptTypes).errors }])
    expect(output$6).toEqual([{ value: undefined, errors: inputTypeInvalidMessage(null, acceptTypes).errors }])
    expect(output$7).toEqual([{ value: undefined, errors: inputTypeInvalidMessage({}, acceptTypes).errors }])
  })

  test('should work well when the types of args are AccountId and Text', () => {
    const message = messages[2]
    // [ { "name": "name", "type": "Text" }, { "name": "contractId", "type": "AccountId" } ]
    const args = message.args
    const acceptTypes = ['String', 'Number']

    const inputs$1 = { name: 'a name example', contractId: 'a account example' }
    const inputs$2 = { name: 1234567890, contractId: 1234567890 }
    const inputs$3 = { name: 0, contractId: 0 }
    const inputs$4 = { name: '', contractId: '' }
    const inputs$5 = { name: undefined, contractId: undefined }
    const inputs$6 = { name: null, contractId: null }
    const inputs$7 = { name: {}, contractId: {} }
    const output$1 = singleInputsValidator(registry, args, inputs$1)
    const output$2 = singleInputsValidator(registry, args, inputs$2)
    const output$3 = singleInputsValidator(registry, args, inputs$3)
    const output$4 = singleInputsValidator(registry, args, inputs$4)
    const output$5 = singleInputsValidator(registry, args, inputs$5)
    const output$6 = singleInputsValidator(registry, args, inputs$6)
    const output$7 = singleInputsValidator(registry, args, inputs$7)

    expect(output$1).toEqual([
      { value: 'a name example', errors: [] },
      { value: 'a account example', errors: [] },
    ])
    expect(output$2).toEqual([
      { value: '1234567890', errors: [] },
      { value: '1234567890', errors: [] }
    ])
    expect(output$3).toEqual([
      { value: '0', errors: [] },
      { value: '0', errors: [] }
    ])
    expect(output$4).toEqual([
      { value: undefined, errors: inputCantBeEmpty().errors },
      { value: undefined, errors: inputCantBeEmpty().errors }
    ])
    expect(output$5).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage(undefined, acceptTypes).errors },
      { value: undefined, errors: inputTypeInvalidMessage(undefined, acceptTypes).errors }
    ])
    expect(output$6).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage(null, acceptTypes).errors },
      { value: undefined, errors: inputTypeInvalidMessage(null, acceptTypes).errors }
    ])
    expect(output$7).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage({}, acceptTypes).errors },
      { value: undefined, errors: inputTypeInvalidMessage({}, acceptTypes).errors }
    ])
  })

  test('should work well when the types of arg is VecFixed', () => {
    const message = messages[4]
    // [ { "name": "contractId", "type": "AccountId" }, { "name": "codeHash", "type": "[u8; 32]" } ]
    const args = message.args
    // [ { "name": "codeHash", "type": "[u8; 32]" } ]
    const argsFiltered = args.filter(arg => arg.name === 'codeHash')
    const acceptTypes = ['String', 'Object']
    const correctValue$1 = Array(32).fill(1)
    const correctValue$2 = Array(32).fill('1')
    const invalidValue$1 = Array(31).fill(1)
    const invalidValue$2 = Array(32).fill('A')
    const invalidValue$3 = Array(32).fill(NaN)
    const invalidValue$4 = Array(32).fill(Infinity)
    const invalidValue$5 = Array(32).fill(-Infinity)
    // An object is `{ 0: 1, 1: 1, ..., 31: 1 }`. It doesn't support.
    const invalidValue$6 = Array(32).fill(1).reduce((_, index) => ({ [index]: 1 }), {})
    const invalidValue$7 = Array(32).fill(1).reduce((_, index) => ({ [index]: 'A' }), {})

    const inputs$1 = { codeHash: 0 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$1)).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage(0, acceptTypes).errors }
    ])

    const inputs$2 = { codeHash: '' }
    expect(singleInputsValidator(registry, argsFiltered, inputs$2)).toEqual([
      { value: undefined, errors: inputCantBeEmpty().errors }
    ])

    const inputs$3 = { codeHash: undefined }
    expect(singleInputsValidator(registry, argsFiltered, inputs$3)).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage(undefined, acceptTypes).errors }
    ])

    const inputs$4 = { codeHash: null }
    expect(singleInputsValidator(registry, argsFiltered, inputs$4)).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage(null, acceptTypes).errors }
    ])

    const inputs$5 = { codeHash: {} }
    expect(singleInputsValidator(registry, argsFiltered, inputs$5)).toEqual([
      { value: undefined, errors: vecInvalidMessage({}).errors }
    ])

    const inputs$6 = { codeHash: 1 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$6)).toEqual([
      { value: undefined, errors: inputTypeInvalidMessage(1, acceptTypes).errors }
    ])

    const inputs$7 = { codeHash: 'A' }
    expect(singleInputsValidator(registry, argsFiltered, inputs$7)).toEqual([
      { value: undefined, errors: vecFixedLengthInvalidMessage('A').errors }
    ])

    const inputs$8 = { codeHash: '{}' }
    expect(singleInputsValidator(registry, argsFiltered, inputs$8)).toEqual([
      { value: undefined, errors: vecInvalidMessage('{}').errors }
    ])

    const inputs$9 = { codeHash: '[]' }
    expect(singleInputsValidator(registry, argsFiltered, inputs$9)).toEqual([
      { value: undefined, errors: vecInvalidMessage('[]').errors }
    ])

    const inputs$10 = { codeHash: '{{' }
    expect(singleInputsValidator(registry, argsFiltered, inputs$10)).toEqual([
      { value: undefined, errors: vecFixedLengthInvalidMessage('{{').errors }
    ])

    const inputs$11 = { codeHash: `${JSON.stringify(correctValue$1)}` }
    expect(singleInputsValidator(registry, argsFiltered, inputs$11)).toEqual([
      { value: correctValue$1.map(_ => new BN(_)), errors: [] }
    ])

    const inputs$12 = { codeHash: `${JSON.stringify(correctValue$2)}` }
    expect(singleInputsValidator(registry, argsFiltered, inputs$12)).toEqual([
      { value: correctValue$2.map(_ => new BN(_)), errors: [] }
    ])

    const inputs$13 = { codeHash: `${JSON.stringify(invalidValue$1)}` }
    expect(singleInputsValidator(registry, argsFiltered, inputs$13)).toEqual([
      { value: undefined, errors: vecFixedLengthInvalidMessage(`${JSON.stringify(invalidValue$1)}`).errors }
    ])

    const inputs$14 = { codeHash: `${JSON.stringify(invalidValue$2)}` }
    expect(singleInputsValidator(registry, argsFiltered, inputs$14)).toEqual([
      { value: [], errors: cantToNumberMessage('A').errors }
    ])

    const inputs$18 = { codeHash: correctValue$1 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$18)).toEqual([
      { value: correctValue$1.map(_ => new BN(_)), errors: [] }
    ])

    const inputs$19 = { codeHash: correctValue$2 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$19)).toEqual([
      { value: correctValue$2.map(_ => new BN(_)), errors: [] }
    ])

    const inputs$20 = { codeHash: invalidValue$1 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$20)).toEqual([
      { value: undefined, errors: vecFixedLengthInvalidMessage(invalidValue$1).errors }
    ])

    const inputs$21 = { codeHash: invalidValue$2 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$21)).toEqual([
      { value: [], errors: cantToNumberMessage('A').errors }
    ])

    const inputs$22 = { codeHash: invalidValue$3 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$22)).toEqual([
      { value: [], errors: cantToNumberMessage(NaN).errors }
    ])

    const inputs$23 = { codeHash: invalidValue$4 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$23)).toEqual([
      { value: [], errors: cantToNumberMessage(Infinity).errors }
    ])
  
    const inputs$24 = { codeHash: invalidValue$5 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$24)).toEqual([
      { value: [], errors: cantToNumberMessage(-Infinity).errors }
    ])

    const inputs$25 = { codeHash: `${JSON.stringify(invalidValue$6)}` }
    expect(singleInputsValidator(registry, argsFiltered, inputs$25)).toEqual([
      { value: undefined, errors: vecInvalidMessage(`${JSON.stringify(invalidValue$6)}`).errors }
    ])

    const inputs$26 = { codeHash: `${JSON.stringify(invalidValue$7)}` }
    expect(singleInputsValidator(registry, argsFiltered, inputs$26)).toEqual([
      { value: undefined, errors: vecInvalidMessage(`${JSON.stringify(invalidValue$7)}`).errors }
    ])

    const inputs$27 = { codeHash: invalidValue$6 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$27)).toEqual([
      { value: undefined, errors: vecInvalidMessage(invalidValue$6).errors }
    ])

    const inputs$28 = { codeHash: invalidValue$7 }
    expect(singleInputsValidator(registry, argsFiltered, inputs$28)).toEqual([
      { value: undefined, errors: vecInvalidMessage(invalidValue$7).errors }
    ])
  })
})

