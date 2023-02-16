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
} from './argumentsValidator'

describe('system meta data test suite', () => {
  // console.log('metadata', metadata, typeof metadata)

  const abi = new Abi(JSON.stringify(metadata))
  // It contains 13 messages
  const messages = abi.messages
  const registry = abi.registry

  // console.log('abi', abi)

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