import { Registry, TypeDefInfo } from '@polkadot/types/types'
import { AbiParam } from '@polkadot/api-contract/types'
import { decamelize } from 'humps'
import { atom } from 'jotai'
import * as R from 'ramda'
import { v4 } from 'uuid'
import { TypeDef } from '@polkadot/types/types'
import { selectAtom, waitForAll } from 'jotai/utils'
import { subToArray, validateNotUndefined, validateSub } from '@/functions/argumentsValidator'
import { currentAbiAtom, currentMethodAtom } from './atoms'
import BN from 'bn.js'
import createLogger from '@/functions/createLogger'

const debug = createLogger('contract arguments atom', 'debug')

/**
 * ---------------------------------------------
 *              Field data
 * ---------------------------------------------
 */

export type PlainTypeEntityAndValue = string | BN | boolean
export type ValueType = PlainTypeEntityAndValue | Record<string, FieldData | null> | FieldData[] | FieldData | undefined
export type ValueTypeNormalized = PlainTypeEntityAndValue | Record<string, string | null> | string[] | null | undefined
export interface FieldData<T = ValueType> {
  uid: string
  typeDef: TypeDef
  value?: T
  errors?: string[]
  displayName?: string
  displayType?: string
  enumFields?: (FieldData<T> | string)[]
  optionField?: FieldData<T> | string
}
export type FieldDataNormalized = FieldData<ValueTypeNormalized>
type EachTypeFieldData = Omit<FieldData<ValueTypeNormalized>, 'typeDef' | 'uid'>
export type FieldDataSet = Record<string, FieldData<ValueTypeNormalized>>

interface FieldDataResult {
  uid: string
  fieldDataSet: FieldDataSet
}

interface EachTypeFieldDataResult {
  fieldData: EachTypeFieldData
  fieldDataSet: FieldDataSet
}

const initEachTypeFieldDataResult = (): EachTypeFieldDataResult => ({
  fieldData: {},
  fieldDataSet: {}
})


export enum FormActionType {
  SetValue = 'SetValue',
  SetErrors = 'SetErrors',
  AddSubField = 'AddSubField',
  RemoveSubField = 'RemoveSubField',
  SetForm = 'SetForm',
}

export interface PayloadType {
  uid?: string,
  value?: ValueTypeNormalized
  errors?: string[]
  typeDef?: TypeDef
  subUid?: string
  form?: FormNormalized
}

export interface FormAction {
  type: FormActionType
  payload?: PayloadType
}

export const formReducer = (prev: FormNormalized, action: FormAction): FormNormalized => {
  const { type, payload = {} } = action
  const { uid = '', subUid, value, errors, typeDef, form } = payload
  switch (type) {
    case FormActionType.SetValue:
      return R.assocPath(['fieldDataSet', uid, 'value'], value, prev)

    case FormActionType.SetErrors:
      return R.assocPath(['fieldDataSet', uid, 'errors'], errors, prev)

    case FormActionType.AddSubField: {
      const { uid: subUid, fieldDataSet } = createFieldData(prev.registry, typeDef as TypeDef)
      const addSubField = R.pipe<[FormNormalized], FormNormalized, FormNormalized>(
        R.modifyPath<string[], string[]>(
          ['fieldDataSet', uid, 'value'],
          R.append(subUid),
        ),
        R.modifyPath<FieldDataSet, FieldDataSet>(
          ['fieldDataSet'],
          R.mergeLeft(fieldDataSet)
        )
      )
      return addSubField(prev)
    }

    case FormActionType.RemoveSubField:
      debug('uid', uid)
      const removeUidList = collectRelativeUidList(prev.fieldDataSet, subUid as string)
      const removeSubField = R.pipe<[FormNormalized], FormNormalized, FormNormalized>(
        R.modifyPath<string[], string[]>(
          ['fieldDataSet', uid, 'value'],
          R.filter(item => item !== subUid)
        ),
        R.modifyPath<FieldDataSet, FieldDataSet>(
          ['fieldDataSet'],
          R.omit(removeUidList)
        )
      )
      const result = removeSubField(prev)
      debug('removeUidList', removeUidList, result)
      return result

    case FormActionType.SetForm:
      return form as FormNormalized
  
    default:
      return prev
  }
}

export function dispatchValue (dispatch: (action: FormAction) => void, uid: string, value?: ValueTypeNormalized) {
  return dispatch({
    type: FormActionType.SetValue,
    payload: {
      uid,
      value,
    }
  })
}

export function dispatchErrors (dispatch: (action: FormAction) => void, uid: string, errors?: string[]) {
  return dispatch({
    type: FormActionType.SetErrors,
    payload: {
      uid,
      errors,
    }
  })
}

const HAS_SUB_FIELD_DATA_TYPE: Readonly<TypeDefInfo[]> = [
  TypeDefInfo.Struct,
  TypeDefInfo.VecFixed,
  TypeDefInfo.Vec,
  TypeDefInfo.Tuple,
  TypeDefInfo.Enum,
  TypeDefInfo.Option,
]

const HAVE_NO_ERRORS_FIELD_DATA_TYPE: Readonly<TypeDefInfo[]> = [
  TypeDefInfo.Struct,
  TypeDefInfo.VecFixed,
  TypeDefInfo.Vec,
  TypeDefInfo.Tuple,
]

// Struct type
const createStructTypeFieldData = (registry: Registry, typeDef: TypeDef): EachTypeFieldDataResult => {
  const { sub } = typeDef
  const subArray = subToArray(sub)
  const initResult = initEachTypeFieldDataResult()

  return R.reduce((result, subItem) => {
    const { name } = subItem

    debug('struct name', name)
    
    if (name) {
      const { uid, fieldDataSet } = createFieldData(registry, subItem)
      return {
        fieldData: {
          ...result.fieldData,
          value: {
            ...(result.fieldData.value as Record<string, string> || {}),
            [name]: uid,
          },
        },
        fieldDataSet: {
          ...result.fieldDataSet,
          ...fieldDataSet,
        }
      }
    } else {
      return result
    }
  }, initResult, subArray)
}

// Vec or VecFixed or Tuple type
const createArrayTypeFieldData = (registry: Registry, typeDef: TypeDef): EachTypeFieldDataResult => {
  const { sub, info, length } = typeDef
  let subArray = subToArray(sub)

  if (info === TypeDefInfo.VecFixed) {
    subArray = new Array(length).fill(sub as TypeDef)
  }

  const initResult = initEachTypeFieldDataResult()

  return R.reduce((result, subItem) => {
    const { uid, fieldDataSet } = createFieldData(registry, subItem)
    return {
      fieldData: {
        ...result.fieldData,
        value: [...(result.fieldData.value as string[] || []), uid]
      },
      fieldDataSet: {
        ...result.fieldDataSet,
        ...fieldDataSet,
      }
    }
  }, initResult, subArray)
}

// Enum type
const createEnumTypeFieldData = (registry: Registry, typeDef: TypeDef): EachTypeFieldDataResult => {
  const { sub } = typeDef

  const variants = subToArray(sub)
  const enums = variants
      .filter(subItem => subItem.type !== 'Null')

  const initResult = initEachTypeFieldDataResult()

  return R.reduce((result, subItem) => {
    const { uid, fieldDataSet } = createFieldData(registry, subItem)
    return {
      fieldData: {
        ...result.fieldData,
        enumFields: [...(result.fieldData.enumFields || []), uid]
      },
      fieldDataSet: {
        ...result.fieldDataSet,
        ...fieldDataSet,
      }
    }
  }, initResult, enums)
}

// Option type
const createOptionTypeFieldData = (registry: Registry, typeDef: TypeDef): EachTypeFieldDataResult => {
  const { sub } = typeDef

  const { uid, fieldDataSet } = createFieldData(registry, sub as TypeDef)

  return {
    fieldData: {
      value: null,
      optionField: uid,
    },
    fieldDataSet,
  }
}

export interface FieldDataOptions {
  isDisplayType?: boolean
}
const createFieldData = (registry: Registry, typeDef: TypeDef, options: FieldDataOptions = {}): FieldDataResult => {
  const { info, sub, type } = typeDef

  validateSub(typeDef)

  
  let fieldResult: EachTypeFieldDataResult = {
    fieldData: {},
    fieldDataSet: {},
  }

  const uid = v4()

  switch (info) {
    case TypeDefInfo.Struct:
      fieldResult = createStructTypeFieldData(registry, typeDef)
      break

    case TypeDefInfo.VecFixed:
    case TypeDefInfo.Vec:
    case TypeDefInfo.Tuple:
      fieldResult = createArrayTypeFieldData(registry, typeDef)
      break

    case TypeDefInfo.Enum:
      fieldResult = createEnumTypeFieldData(registry, typeDef)
      break
  
    case TypeDefInfo.Option:
      fieldResult = createOptionTypeFieldData(registry, typeDef)
      break

    case TypeDefInfo.Compact:
      return createFieldData(registry, sub as TypeDef)

    case TypeDefInfo.Si:
      return createFieldData(registry, registry.lookup.getTypeDef(type))
  
    default:
      break
  }

  debug('fieldResult', fieldResult, uid)

  return {
    uid,
    fieldDataSet: {
      ...fieldResult.fieldDataSet,
      [uid]: {
        uid,
        typeDef,
        displayType: options.isDisplayType ? formatTypeName(typeDef.type) : undefined,
        ...fieldResult.fieldData,
      }
    }
  }
}

// In order to make the type name easier to understand,
// some name conversions need to done.
export const formatTypeName = (typeName: string) => {
  // Text => String
  // Bytes => Vec<u8>, bytes can receive string format, only display to Vec<u8>
  return typeName
    .replace(/(?<![0-9a-zA-Z])Text(?![0-9a-zA-Z])/g, 'String')
    .replace(/(?<![0-9a-zA-Z])Bytes(?![0-9a-zA-Z])/g, 'Vec<u8>')
}

interface FormNormalizedBuild {
  formData: Record<string, string>
  fieldDataSet: FieldDataSet
}

interface FormNormalized extends FormNormalizedBuild {
  registry: Registry
}


const createFormData = (registry: Registry, id: string, abiParams: AbiParam[]): FormNormalizedBuild => {
  const initResult: FormNormalizedBuild = { formData: {}, fieldDataSet: {} }


  return R.reduce((result, abiParam) => {
    const { name, type } = abiParam
    const displayName = decamelize(name)
    const { uid, fieldDataSet } = createFieldData(registry, type, { isDisplayType: true })

    return {
      formData: {
        ...result.formData,
        [displayName]: uid,
      },
      fieldDataSet: {
        ...result.fieldDataSet,
        ...fieldDataSet,
      }
    }
  }, initResult, abiParams)
}

// Use an object represent the form.
export const currentArgsFormAtomInAtom = atom(get => {
  const [{ registry, messages }, selectedMethodSpec] = get(waitForAll([
    currentAbiAtom,
    currentMethodAtom,
  ]))
  const message = messages.find(message => message.identifier === selectedMethodSpec?.label)

  let formBuild: FormNormalizedBuild = {
    formData: {},
    fieldDataSet: {},
  }

  if (message) {
    const { args: abiParams, identifier: id } = message
    formBuild = createFormData(registry, id, abiParams)
  }
  
  const form: FormNormalized = {
    ...formBuild,
    registry,
  }

  debug('form', form)

  const formAtom = atom(form)

  return formAtom
})

export const currentArgsFormAtom = atom(get => get(get(currentArgsFormAtomInAtom)), (get, set, update: FormNormalized) => {
  const currentArgsFormAtom = get(currentArgsFormAtomInAtom)
  set(currentArgsFormAtom, update)
})
export const currentFieldDataSetReadOnlyAtom = selectAtom(currentArgsFormAtom, form => form.fieldDataSet)

export const getFieldValue = (fieldDataSet: FieldDataSet, uid: string): unknown => {
  const fieldData = fieldDataSet[uid]
  const { typeDef: { info }, value } = fieldData

  if (HAS_SUB_FIELD_DATA_TYPE.indexOf(info) > -1) {
    if (typeof value === 'string') {
      return getFieldValue(fieldDataSet, value)
    } else if (Array.isArray(value)) {
      return value.map(uid => getFieldValue(fieldDataSet, uid))
    } else if (R.is(Object, value)) {
      return R.reduce((result, key) => {
        const uid = (value as Record<string, string | null>)[key]
        return {
          ...result,
          [key]: uid && getFieldValue(fieldDataSet, uid)
        }
      }, {} as Record<string, unknown>, Object.keys(value as Record<string, string | null>))
    }
  }

  return value
}

export const getFormValue = (form: FormNormalized) => {
  const { formData, fieldDataSet } = form

  return R.reduce((result, key) => {
    const fieldUid = formData[key]
    const value = getFieldValue(fieldDataSet, fieldUid)
    return {
      ...result,
      [key]: value,
    }
    
  }, {} as Record<string, unknown>, Object.keys(formData))
}

export const collectRelativeUidList = (fieldDataSet: FieldDataSet, uid: string): string[] => {
  const fieldData = fieldDataSet[uid]
  const { typeDef: { info }, value } = fieldData
  const uidList = [uid]
  let subUidList: string[] = []

  if (HAS_SUB_FIELD_DATA_TYPE.indexOf(info) > -1) {
    if (typeof value === 'string') {
      subUidList = collectRelativeUidList(fieldDataSet, value)
    } else if (Array.isArray(value)) {
      subUidList = R.flatten(
        R.map(uid => collectRelativeUidList(fieldDataSet, uid), value)
      )
    } else if (R.is(Object, value)) {
      const object = value as Record<string, string | null>
      const values = R.filter(_ => Boolean(_), R.values(object)) as string[]
      subUidList = R.flatten(
        R.map(uid => collectRelativeUidList(fieldDataSet, uid), values)
      )
    }
  }

  return R.concat(uidList, subUidList)
}

export const getCheckedFieldData = (fieldData: FieldDataNormalized, isRendered: boolean): FieldDataNormalized => {
  const { typeDef: { info }, value, errors } = fieldData

  if (!isRendered) {
    if (errors && errors.length) {
      return R.assoc('errors', undefined, fieldData)
    }
  } else {
    if (HAVE_NO_ERRORS_FIELD_DATA_TYPE.indexOf(info) === -1) {
      if (info === TypeDefInfo.Enum) {
        let checkedErrors = validateNotUndefined(value)
        if (!checkedErrors.length) {
          const value$1 = value as Record<string, string | null>
          const nestValue = R.values(value$1)[0]
          checkedErrors = validateNotUndefined(nestValue)
        }

        if (checkedErrors.length && !R.equals(errors, checkedErrors)) {
          return R.assoc('errors', checkedErrors, fieldData)
        }
      } else {
        const checkedErrors = validateNotUndefined(value)
        if (checkedErrors.length && !R.equals(errors, checkedErrors)) {
          return R.assoc('errors', checkedErrors, fieldData)
        }
      }
    }
  }
  return fieldData
}

export const getCheckedForm = (form: FormNormalized) => {
  const { formData, fieldDataSet } = form
  const originUidList = R.values(formData)
  const renderedUidList = R.flatten(
    R.map(uid => collectRelativeUidList(fieldDataSet, uid), originUidList)
  )
  const uidList = Object.keys(fieldDataSet)

  const fieldDataSetChecked = R.reduce((result, uid) => {
    const fieldData = fieldDataSet[uid]
    const isRendered = R.includes(uid, renderedUidList)
    const nextFieldData = getCheckedFieldData(fieldData, isRendered)
    return {
      ...result,
      [uid]: nextFieldData,
    }
  }, {} as FieldDataSet, uidList)

  return {
    ...form,
    fieldDataSet: fieldDataSetChecked,
  }
}

export const getFormIsInvalid = (form: FormNormalized) => {
  const { fieldDataSet } = form
  const uidList = Object.keys(fieldDataSet)

  return R.findIndex(
    uid => Boolean(R.path([uid, 'errors', 'length'], fieldDataSet)),
    uidList,
  ) > -1
}