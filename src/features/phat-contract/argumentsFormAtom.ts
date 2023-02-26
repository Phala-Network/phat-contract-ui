import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai'
import { Registry, TypeDefInfo } from '@polkadot/types/types'
import { AbiParam } from '@polkadot/api-contract/types'
import { decamelize } from 'humps'
import { atom } from 'jotai'
import { TypeDef } from '@polkadot/types/types'
import { waitForAll } from 'jotai/utils'
import { subToArray, validateNotUndefined, validateSub } from '@/functions/argumentsValidator'
import { currentAbiAtom, currentMethodAtom } from './atoms'

/**
 * --------------------------------
 *              Utils
 * --------------------------------
 */

// Simple Uid generation.
export const createUid = () => String(new Date().getTime() * Math.random() * 100000)

export type DataEntryErrorsAtom = WritableAtom<string[], string[], void>
const createDataEntryErrorsAtom = (): DataEntryErrorsAtom => atom<string[]>([])

/**
 * ---------------------------------------------
 *              Data entry atom
 * ---------------------------------------------
 */

export type EntityAtom<T> = PrimitiveAtom<T>
export type DataEntryAtom<TEntity = any, TValue = any> = Atom<{
  id: string
  typeDef: TypeDef
  entityAtom: EntityAtom<TEntity>
  errorsAtom: DataEntryErrorsAtom
  execValidateAtom: WritableAtom<null, unknown, void>
  clearErrorsAtom: WritableAtom<null, unknown, void>
  valueOf: () => TValue
  errorsOf: () => string[]
  dispatches?: Record<string, WritableAtom<any, any, any>>
  [key: string]: unknown
}>

// Plain type
export type PlainTypeEntityAndValue = string | number | boolean | undefined
const createPlainTypeDataEntryAtom = (typeDef: TypeDef): DataEntryAtom<PlainTypeEntityAndValue, PlainTypeEntityAndValue> => {
  const entityAtom = atom<PlainTypeEntityAndValue>(undefined)
  const errorsAtom = createDataEntryErrorsAtom()
  const execValidateAtom = atom(null, (get, set) => {
    const entity = get(entityAtom)
    const errors = validateNotUndefined(entity)
    if (errors.length) {
      set(errorsAtom, errors)
    }
  })
  const clearErrorsAtom = atom(null, (_, set) => set(errorsAtom, []))
  const baseDataEntryAtom = atom({
    id: createUid(),
    typeDef,
    entityAtom,
    errorsAtom,
    execValidateAtom,
    clearErrorsAtom,
  })

  return atom(get => {
    const valueOf = () => get(entityAtom)
    const errorsOf = () => get(errorsAtom)
    const baseDataEntry = get(baseDataEntryAtom)
    return {
      ...baseDataEntry,
      valueOf,
      errorsOf,
    }
  })
}

// Struct type
export type StructEntity = Record<string, DataEntryAtom>
export type StructValue = Record<string, unknown>
const createStructTypeDataEntryAtom = (registry: Registry, typeDef: TypeDef): DataEntryAtom<StructEntity, StructValue> => {
  const { sub } = typeDef
  const subArray = subToArray(sub)

  // Atom<{ [key]: DataEntryAtom }>
  const entityAtom: EntityAtom<StructEntity> = atom(subArray.reduce((entity, subItem) => {
    const { name } = subItem

    if (name) {
      return {
        ...entity,
        [name]: createDataEntryAtom(registry, subItem)
      }
    } else {
      return entity
    }

  }, {}))
  const execValidateAtom = atom(null, (get, set) => {
    const entity = get(entityAtom)

    Object.keys(entity).forEach(key => {
      const entityItemAtom = entity[key]
      const entityItem = get(entityItemAtom)
      const { execValidateAtom: subExecValidateAtom } = entityItem
      set(subExecValidateAtom)
    })
  })
  const clearErrorsAtom = atom(null, (get, set) => {
    const entity = get(entityAtom)

    Object.keys(entity).forEach(key => {
      const entityItemAtom = entity[key]
      const entityItem = get(entityItemAtom)
      const { clearErrorsAtom: subClearErrorsAtom } = entityItem
      set(subClearErrorsAtom)
    })
  })
  const baseDataEntryAtom = atom({
    id: createUid(),
    typeDef,
    entityAtom,
    execValidateAtom,
    errorsAtom: createDataEntryErrorsAtom(),
    clearErrorsAtom,
  })

  return atom(get => {
    const valueOf = () => {
      const entity = get(entityAtom)
      return Object.keys(entity).reduce((result, key) => {
        const entityValueAtom = entity[key]
        const entityValue = get(entityValueAtom).valueOf()
        return {
          ...result,
          [key]: entityValue,
        }
      }, {})
    }
    const errorsOf = () => {
      const entity = get(entityAtom)
      return Object.keys(entity).reduce((result, key) => {
        const entityValueAtom = entity[key]
        const errors = get(entityValueAtom).errorsOf()
        return result.concat(errors)
      }, [] as string[])
    }
    const baseDataEntry = get(baseDataEntryAtom)

    return {
      ...baseDataEntry,
      valueOf,
      errorsOf,
    }
  })
}

// Vec or VecFixed or Tuple type
export type VecEntity = DataEntryAtom[]
const createArrayTypeDataEntryAtom = (registry: Registry, typeDef: TypeDef): DataEntryAtom<VecEntity, unknown[]> => {
  const { sub, info, length } = typeDef
  let subArray = subToArray(sub)

  if (info === TypeDefInfo.VecFixed) {
    subArray = new Array(length).fill(sub as TypeDef)
  }

  // Atom<[DataEntryAtom]>
  const entityAtom: EntityAtom<VecEntity> = atom(
    subArray.map(subItem => createDataEntryAtom(registry, subItem))
  )
  const execValidateAtom = atom(null, (get, set) => {
    const entity = get(entityAtom)

    entity.forEach(entityItemAtom => {
      const entityItem = get(entityItemAtom)
      const { execValidateAtom: subExecValidateAtom } = entityItem
      set(subExecValidateAtom)
    })
  })
  const clearErrorsAtom = atom(null, (get, set) => {
    const entity = get(entityAtom)

    entity.forEach(entityItemAtom => {
      const entityItem = get(entityItemAtom)
      const { clearErrorsAtom: subClearErrorsAtom } = entityItem
      set(subClearErrorsAtom)
    })
  })
  const baseDataEntryAtom = atom({
    id: createUid(),
    typeDef,
    entityAtom,
    execValidateAtom,
    clearErrorsAtom,
    errorsAtom: createDataEntryErrorsAtom(),
  })

  // Only Vec type has follow method
  const addEntity = atom(null, (get, set) => {
    const entity = get(entityAtom)
    set(entityAtom, entity.concat([
      createDataEntryAtom(registry, sub as TypeDef)
    ]))
  })
  const removeEntity = atom(null, (get, set, id: string) => {
    const entity = get(entityAtom)
    set(entityAtom, entity.filter(entityItemAtom => {
      const entityItem = get(entityItemAtom)
      return entityItem.id !== id
    }))
  })

  return atom(get => {
    const valueOf = () => {
      const entity = get(entityAtom)
      return entity.map(itemAtom => {
        const item = get(itemAtom)
        return item.valueOf()
      })
    }
    const errorsOf = () => {
      const entity = get(entityAtom)
      return entity.reduce((result, itemAtom) => {
        const item = get(itemAtom)
        return result.concat(item.errorsOf())
      }, [] as string[])
    }
    const baseDataEntry = get(baseDataEntryAtom)

    return {
      ...baseDataEntry,
      valueOf,
      errorsOf,
      dispatches: info !== TypeDefInfo.Vec ? undefined : {
        addEntity,
        removeEntity,
      }
    }
  })
}

// Enum type
export type EnumEntity = VecEntity
export type EnumValue = Record<string, unknown | null> | undefined
const createEnumTypeDataEntryAtom = (registry: Registry, typeDef: TypeDef): DataEntryAtom<EnumEntity, EnumValue> => {
  const { sub } = typeDef

  const variants = subToArray(sub)

  const selectedVariantNameAtom = atom<string | undefined>(undefined)
  const entityAtom: EntityAtom<VecEntity> = atom(
    variants
      .filter(subItem => subItem.type !== 'Null')
      .map(subItem => createDataEntryAtom(registry, subItem))
  )
  const errorsAtom = createDataEntryErrorsAtom()
  const execValidateAtom = atom(null, (get, set) => {
    const selectedVariantName = get(selectedVariantNameAtom)
    const nameErrors = validateNotUndefined(selectedVariantName)

    if (nameErrors.length) {
      set(errorsAtom, nameErrors)
    } else {
      const variantIndex = variants.findIndex(item => item.name === selectedVariantName)
      const entity = get(entityAtom)
      // Clear all entityItem errors except target variantIndex
      entity.forEach((entityItemAtom, index) => {
        const entityItem = get(entityItemAtom)
        const { execValidateAtom: subExecValidateAtom, clearErrorsAtom: subClearErrorsAtom } = entityItem
        if (index === variantIndex) {
          set(subExecValidateAtom)
        } else {
          set(subClearErrorsAtom)
        }
      })
    }
  })
  const clearErrorsAtom = atom(null, (get, set) => {
    set(errorsAtom, [])
    const entity = get(entityAtom)
    entity.forEach((entityItemAtom) => {
      const entityItem = get(entityItemAtom)
      const { clearErrorsAtom: subClearErrorsAtom } = entityItem
      set(subClearErrorsAtom)
    })
  })
  const baseDataEntryAtom = atom({
    id: createUid(),
    typeDef,
    selectedVariantNameAtom,
    entityAtom,
    errorsAtom,
    execValidateAtom,
    clearErrorsAtom,
  })

  const selectAVariant = atom(null, (_, set, variantName: string) => {
    set(selectedVariantNameAtom, variantName)
  })

  return atom(get => {
    const valueOf = () => {
      const selectedVariantName = get(selectedVariantNameAtom)
      if (!selectedVariantName) {
        return undefined
      } else {
        const variantIndex = variants.findIndex(item => item.name === selectedVariantName)
        const variant = variants[variantIndex]
        if (variant.type === 'Null') {
          return {
            [selectedVariantName]: null
          }
        } else {
          const entity = get(entityAtom)
          const targetEntityItemAtom = entity[variantIndex]
          const targetEntityItem = get(targetEntityItemAtom)
          return {
            [selectedVariantName]: targetEntityItem.valueOf()
          }
        }
      }
    }
    const errorsOf = () => {
      const errors = get(errorsAtom)
      const selectedVariantName = get(selectedVariantNameAtom)
      if (!selectedVariantName) {
        return errors
      } else {
        const variantIndex = variants.findIndex(item => item.name === selectedVariantName)
        const variant = variants[variantIndex]
        if (variant.type === 'Null') {
          return errors
        } else {
          const entity = get(entityAtom)
          const targetEntityItemAtom = entity[variantIndex]
          const targetEntityItem = get(targetEntityItemAtom)
          return errors.concat(targetEntityItem.errorsOf())
        }
      }
    }
    const baseDataEntry = get(baseDataEntryAtom)

    return {
      ...baseDataEntry,
      valueOf,
      errorsOf,
      dispatches: {
        selectAVariant,
      },
    }
  })
}

// Option type
const createOptionTypeDataEntryAtom = (registry: Registry, typeDef: TypeDef): DataEntryAtom<DataEntryAtom, unknown | null> => {
  const { sub } = typeDef

  const enableOptionAtom = atom<boolean>(false)
  const entityAtom = atom(createDataEntryAtom(registry, sub as TypeDef))
  const errorsAtom = createDataEntryErrorsAtom()
  const execValidateAtom = atom(null, (get, set) => {
    const enableOption = get(enableOptionAtom)
    const { execValidateAtom: subExecValidateAtom, clearErrorsAtom: subClearErrorsAtom } = get(get(entityAtom))
    if (enableOption) {
      set(subExecValidateAtom)
    } else {
      set(subClearErrorsAtom)
    }
  })
  const clearErrorsAtom = atom(null, (get, set) => {
    const { clearErrorsAtom: subClearErrorsAtom } = get(get(entityAtom))
    set(subClearErrorsAtom)
  })
  const baseDataEntryAtom = atom({
    id: createUid(),
    typeDef,
    enableOptionAtom,
    entityAtom,
    errorsAtom,
    execValidateAtom,
    clearErrorsAtom,
  })

  return atom(get => {
    const valueOf = () => {
      const enableOption = get(enableOptionAtom)
      if (enableOption) {
        const entity = get(entityAtom)
        const entityItem = get(entity)
        return entityItem.valueOf()
      } else {
        return null
      }
    }
    const errorsOf = () => {
      const enableOption = get(enableOptionAtom)
      if (enableOption) {
        const entity = get(entityAtom)
        const entityItem = get(entity)
        return entityItem.errorsOf()
      } else {
        return []
      }
    }
    const baseDataEntry = get(baseDataEntryAtom)

    return {
      ...baseDataEntry,
      valueOf,
      errorsOf,
    }
  })
}

const createDataEntryAtom = (registry: Registry, typeDef: TypeDef): DataEntryAtom => {
  const { info, sub, type } = typeDef

  validateSub(typeDef)

  switch (info) {
    case TypeDefInfo.Plain:
      return createPlainTypeDataEntryAtom(typeDef)

    case TypeDefInfo.Struct:
      return createStructTypeDataEntryAtom(registry, typeDef)

    case TypeDefInfo.VecFixed:
    case TypeDefInfo.Vec:
    case TypeDefInfo.Tuple:
      return createArrayTypeDataEntryAtom(registry, typeDef)

    case TypeDefInfo.Enum:
      return createEnumTypeDataEntryAtom(registry, typeDef)
  
    case TypeDefInfo.Option:
      return createOptionTypeDataEntryAtom(registry, typeDef)

    case TypeDefInfo.Compact:
      return createDataEntryAtom(registry, sub as TypeDef)

    case TypeDefInfo.Si:
      return createDataEntryAtom(registry, registry.lookup.getTypeDef(type))
  
    default:
      return createPlainTypeDataEntryAtom(typeDef)
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
interface IArg {
  abiParam: AbiParam
  displayName: string
  displayType: string
  rootDataEntryAtom: DataEntryAtom
}
export type ArgAtom = PrimitiveAtom<IArg>
const createArgAtom = (registry: Registry, abiParam: AbiParam): ArgAtom => {
  const { name, type } = abiParam
  const displayName = decamelize(name)
  const displayType = formatTypeName(type.type)
  // - Each argument should have an argument info area and a data entry area.
  // - Each data entry area should have a sub data entry area and
  //   an error messages area.
  // - Each data entry created by TypeDef.
  return atom({
    abiParam,
    displayName,
    displayType,
    rootDataEntryAtom: createDataEntryAtom(registry, type),
  })
}

// There is a cache for remember atom when call the same atom at the same time in different places.
let argsAtomsCache: Record<string, ArgAtom[]> = {}
export const clearAtomsCache = () => {
  argsAtomsCache = {}
}
const createArgsAtoms = (registry: Registry, id: string, abiParams: AbiParam[]): ArgAtom[] => {
  const atomCached = argsAtomsCache[id]
  if (atomCached) {
    return atomCached
  } else {
    const argsAtoms = abiParams.map(abiParam => createArgAtom(registry, abiParam))
    // Only cache a message args atoms at the same time
    argsAtomsCache = { [id]: argsAtoms }
    return argsAtoms
  }
}

// Use an object represent the form.
export const currentArgsFormAtom = atom(get => {
  const [{ registry, messages }, selectedMethodSpec] = get(waitForAll([
    currentAbiAtom,
    currentMethodAtom,
  ]))
  const message = messages.find(message => message.identifier === selectedMethodSpec?.label)

  let args: ArgAtom[] = []
  if (message) {
    const { args: abiParams, identifier: id } = message
    args = createArgsAtoms(registry, id, abiParams)
  }

  return { args }
})

// Get all arguments' values function.
export const currentArgsFormValueOfAtom = atom(get => {
  const currentArgsForm = get(currentArgsFormAtom)
  const { args } = currentArgsForm
  
  return () => args.reduce((result, argAtom) => {
    const arg = get(argAtom)
    const { displayName, rootDataEntryAtom } = arg
    const rootDataEntry = get(rootDataEntryAtom)

    return {
      ...result,
      [displayName]: rootDataEntry.valueOf(),
    }
  }, {} as Record<string, unknown>)
})

// Get all arguments' errors function.
export const currentArgsFormErrorsOfAtom = atom(get => {
  const currentArgsForm = get(currentArgsFormAtom)
  const { args } = currentArgsForm
  
  return () => args.reduce((result, argAtom) => {
    const arg = get(argAtom)
    const { rootDataEntryAtom } = arg
    const rootDataEntry = get(rootDataEntryAtom)
    const errors = rootDataEntry.errorsOf()

    return result.concat(errors)
  }, [] as string[])
})

// Validate total form
export const currentArgsFormValidateAtom = atom(null, (get, set) => {
  const currentArgsForm = get(currentArgsFormAtom)
  const { args } = currentArgsForm

  args.forEach(argAtom => {
    const arg = get(argAtom)
    const { rootDataEntryAtom } = arg
    const { execValidateAtom } = get(rootDataEntryAtom)

    set(execValidateAtom)
  })
})

// Clear Validations. 
export const currentArgsFormClearValidationAtom = atom(null, (get, set) => {
  const currentArgsForm = get(currentArgsFormAtom)
  const { args } = currentArgsForm

  args.forEach(argAtom => {
    const arg = get(argAtom)
    const { rootDataEntryAtom } = arg
    const { clearErrorsAtom } = get(rootDataEntryAtom)

    set(clearErrorsAtom)
  })
})