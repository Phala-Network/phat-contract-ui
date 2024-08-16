import type { ContractPromise } from '@polkadot/api-contract'
import type { AnyJson } from '@polkadot/types/types'
import type { u64, Option } from '@polkadot/types'
import type { BN } from '@polkadot/util'

import { isClosedBetaEnv } from '@/vite-env'
import { useMemo, useCallback, useEffect, useState } from 'react'
import { type Atom, type WritableAtom, atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { type SetAtom } from 'jotai/core/atom'
import { useQuery } from '@tanstack/react-query'
import { atomFamily, atomWithReset, atomWithStorage, loadable } from 'jotai/utils'
import { atomWithQuery } from 'jotai/query'
import * as R from 'ramda'
import { Keyring } from '@polkadot/api'
import { Abi } from '@polkadot/api-contract'
import {
  OnChainRegistry,
  PinkLoggerContractPromise,
  type CertificateData,
  signCertificate,
  unsafeGetAbiFromGitHubRepoByCodeHash,
  unsafeGetContractCodeHash,
  type SerMessage,
  PinkBlueprintPromise,
  PinkContractPromise,
  signAndSend,
} from '@phala/sdk'
import { validateHex } from '@phala/ink-validator'
import { isRight } from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'
import Decimal from 'decimal.js'
import ms from 'ms'

import { apiPromiseAtom, dispatchEventAtom } from '@/features/parachain/atoms'
import { atomWithQuerySubscription } from '@/features/parachain/atomWithQuerySubscription'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import { endpointAtom } from '@/atoms/endpointsAtom'
import { type DepositSettingsValue } from './atomsWithDepositSettings'
import { type PinkContractSendOptions } from '@phala/sdk'


export interface SelectorOption {
  value: string
  label: string
  selected: boolean
  argCounts: number
}

export interface LocalContractInfo {
  contractId: string;
  metadata: ContractMetadata;
  savedAt?: number;
}

export interface ContractExecuteResult {
  contract: LocalContractInfo;
  methodSpec: ContractMetaMessage;
  succeed: boolean;
  args: Record<string, unknown>;
  output?: AnyJson;
  completedAt: number;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Staging contract candidate for Upload & instantiate
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const candidateAtom = atom<ContractMetadata | null>(null)

export const candidateFileInfoAtom = atomWithReset({ name: '', size: 0 })
export const candidateAllowIndeterminismAtom = atomWithReset(false)

export const contractParserErrorAtom = atom('')
export const contractWASMInvalid = atom(false)

export const contractAvailableSelectorAtom = atom(get => {
  const contract = get(candidateAtom)
  if (!contract) {
    return []
  }
  const spec = contract.V3 ? contract.V3.spec : contract.spec
  let defaults: any = spec.constructors.filter(i => i.label === 'default')
  if (!defaults) {
    defaults = R.head(spec.constructors)
  }
  return [...spec.constructors.map(i => ({
    value: i.selector,
    label: i.label,
    default: i.selector === defaults?.selector,
    argCounts: i.args.length,
  }))]
})

export const contractSelectedInitSelectorAtom = atom('')

export const contractSelectorOptionListAtom = atom(get => {
  const options = get(contractAvailableSelectorAtom)
  const selected = get(contractSelectedInitSelectorAtom)
  return options.map(i => ({
    value: i.value,
    label: i.label,
    selected: selected ? i.value === selected : i.default,
    argCounts: i.argCounts,
  }))
})

export const contractFinalInitSelectorAtom = atom(get => {
  const options = get(contractSelectorOptionListAtom)
  const found = options.filter(i => i.selected)
  if (found.length) {
    return found[0].value
  }
  return ''
})

interface FileInfo {
  file: File
  isCheckWASM: boolean
}

export const contractCandidateAtom = atom('', (get, set, fileInfo: FileInfo) => {
  const { file, isCheckWASM } = fileInfo
  // file size can't > 2MB
  if (file?.size && file.size / 1024 / 1024 > 2) {
  // // easy to debug
  // if (file?.size && file.size > 2) {
    set(contractParserErrorAtom, 'Your contract file size is over 2MB. Please change to another one.')
    return
  }

  const reader = new FileReader()
  set(contractParserErrorAtom, '')
  set(contractWASMInvalid, false)
  reader.addEventListener('load', () => {
    try {
      const contract = JSON.parse(reader.result as string)
      // if (!contract || !contract.source || !contract.source.hash || !contract.source.wasm) {
      if (!contract || !contract.source || !contract.source.hash) {
        set(contractParserErrorAtom, "Your contract file is invalid.")
        return
      }

      try {
        new Abi(contract)
      } catch (err) {
        set(contractParserErrorAtom, `Your contract file is invalid: ${err}`)
        return
      }

      if (isCheckWASM) {
        // const isAllowIndeterminism = get(candidateAllowIndeterminismAtom)
        // if valid pass, validResult is ''
        // if valid failed, validResult is the failed error
        // const validResult = validateHex((contract.source?.wasm || '') as string, isAllowIndeterminism)
        const validResult = validateHex((contract.source?.wasm || '') as string, false)
        if (validResult) {
          set(contractParserErrorAtom, `Your contract file is invalid: ${validResult}`)
          set(contractWASMInvalid, true)
          return
        }
      }

      set(candidateFileInfoAtom, { name: file.name, size: file.size })
      set(candidateAtom, contract)
    } catch (e) {
      console.error(e)
      set(contractParserErrorAtom, `Your contract file is invalid: ${e}`)
    }
  })
  reader.readAsText(file, 'utf-8')
})

export const contractAttachTargetAtom = atom('')

export const blueprintPromiseAtom = atom<PinkBlueprintPromise | null>(null)
export const instantiatedContractIdAtom = atom<string | null>(null)

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Contract Metadata
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

type ContractKey = string

export const localContractsAtom = atomWithStorage<
  Record<ContractKey, LocalContractInfo>
>('owned-contracts', {})

export function useContractList() {
  const localContracts = useAtomValue(localContractsAtom)
  const apiQuery = useAtomValue(loadable(apiPromiseAtom))
  const instantiatedContractListQuery = useQuery(
    ['phalaPhatContracts.contracts', apiQuery.state, localContracts],
    async () => {
      const contractKeys = R.keys(localContracts)
      if (apiQuery.state !== 'hasData' || !apiQuery.data || contractKeys.length === 0) {
        return {}
      }
      const api = apiQuery.data
      const queries = R.map(i => [api.query.phalaPhatContracts.contracts, i], contractKeys)
      // @ts-ignore
      const results: Option<BasicContractInfo>[] = await (api.queryMulti(queries) as unknown as Promise<Option<BasicContractInfo>[]>)
      const pairs = R.map(
        ([contractKey, info]) => info.isSome ? [contractKey, true] : [contractKey, false],
        R.zip(contractKeys, results)
      ) as [string, boolean][]
      return R.fromPairs<boolean>(pairs)
    }
  )
  return useMemo(() => {
    const { isLoading, data } = instantiatedContractListQuery
    const availableChecks = data || {}
    return R.pipe(
      R.toPairs,
      R.sortBy(i => R.propOr(0, 'savedAt', i[1])),
      lst => R.reverse(lst) as unknown as [ContractKey, LocalContractInfo][],
      R.map(([k, info]) => {
        return [k, { ...info, isLoading, isAvailable: availableChecks[k] as boolean }] as [ContractKey, LocalContractInfo & { isLoading: boolean, isAvailable: boolean }]
      }),
    )(localContracts)
  }, [localContracts, instantiatedContractListQuery])
}

export function useRemoveLocalContract(contractKey: ContractKey) {
  const updateLocalContracts = useSetAtom(localContractsAtom)
  return useCallback(() => {
    updateLocalContracts(data => R.omit([contractKey], data))
  }, [contractKey, updateLocalContracts])
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Cluster
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const currentClusterIdAtom = atomWithStorage('user-selected-cluster', '0x0000000000000000000000000000000000000000000000000000000000000001')

export const registeredClusterListAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  return {
    queryKey: ['phalaPhatContracts.clusters'],
    queryFn: async () => {
      const result = await api.query.phalaPhatContracts.clusters.entries()
      const transformed: Pairs<string, ClusterInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.args.map(i => i.toPrimitive()) as string[]
        const info = value.unwrap().toJSON()
        info.id = keys[0]
        return [keys[0], info]
      })
      return transformed
    },
  }
})

export const availableClusterOptionsAtom = atom(get => {
  const clusters = get(registeredClusterListAtom)
  const options = clusters.map(([id, obj]) => {
    const { permission } = obj
    const permissionKey = R.head(R.keys(permission))
    return { label: `[${permissionKey}] ${id.substring(0, 6)}...${id.substring(id.length - 6)}`, value: id }
  })
  return options
})

export const currentClusterAtom = atom(get => {
  const clusters = get(registeredClusterListAtom)
  let currentClusterId = get(currentClusterIdAtom)
  const found = R.find(([id]) => id === currentClusterId, clusters)
  if (found) {
    return found[1]
  }
  if (clusters.length) {
    return clusters[0][1]
  }
  return null
}, (_, set, value: string) => {
  set(currentClusterIdAtom, value)
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Worker
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const userSelectedWorkerIdAtom = atomWithStorage<Record<string, string>>('user-selected-worker', {})

function shuffle<T>(lst: Readonly<T[]>) {
  const idx = Math.floor(lst.length * Math.random())
  return lst[idx]
}

export const currentWorkerIdAtom = atom(
  get => {
    const rec = get(userSelectedWorkerIdAtom)
    const endpoint = get(endpointAtom)
    const workers = get(availableWorkerListAtom)
    if (rec[endpoint]) {
      if (!R.includes(rec[endpoint], workers)) {
        console.info('user selected worker is not available', rec[endpoint], workers)
        return shuffle(workers)
      }
      return rec[endpoint]!
    }

    if (isClosedBetaEnv) {
      return shuffle(workers)
    } else {
      return R.head(workers)
    }
  },
  (get, set, value: string) => {
    const endpoint = get(endpointAtom)
    const rec = get(userSelectedWorkerIdAtom)
    set(userSelectedWorkerIdAtom, {...rec, [endpoint]: value})
  }
)

const ExcludedWorkers = [
  // Mainnet
  "0xaea665ac1848250edd0e6392592006fd21d21ad9bf180789fdc0ccbd527a2210",
  "0x4e4e139e3007425f611c1e5f31378212be41ed9bbff949e25b026aef0ae8f73b",
  "0x46f31a5d3d86e41f563a7b2cf993818b9ef56bb521558937371ac6a45bba0d49",
  "0x847b1e546c9d0bff3b11fd1f8ff50b09574a47c4b5de51c669b87f9b346fdb07",
  "0x128d1eecc086422596410ad1d71b9d91f65c2c3c774fece83ae68f1e83c82017",
  "0xe0af65f1145e19d3fd5d43ff7fcbeee8c8845ed899de4fc78b144f48a9c1ef52",
  "0x0aefcc20301ad8a61ee385e6acdd5f37c6cd4f00cfb121722738645405727f4f",
  "0xe2634787ddc71ab62de0402a587bad6f9fcead565a9023ba001ee0088220e26b",
  "0x7000d2e71f7390afb0e6ad0b165ea3f95c8e08f01275ffd56be415166712781f",
  "0xfe33e0de3775bbffd193a681609867c72adafe7d19d403f8aa88cd24b3c9c968",
  "0x3a765500cbc52cec00e2abb645599002e888ba16d7d821c405ba3fcf8a884910",
  "0x20f270bc1db4ec7d5cc3cc29c48d3280fadc1ec86ed9a3b3c6747b8676256539",
  "0x2ee03d1b58dde3c65dba79ab0360d67de5a6737ca8c6cf11f70100c6cf8dde26",
  "0x8c97086ea2755a79931445518e869e701aca8e9820e34ce80303d2f5993f512b",
  "0xe26d870194dfd1b41d53aba152aa7e3adce0b04241ca125919898c9c0206d12a",
  "0x24a76d62e8e729b0585c64f6392a4393e21a91227bfa4febb42a879b3b9be81f",
  "0x8c63ab05c5412c9016fb7c7efa80a750d37c12278ff02dafebf8985ee9f46127",
  "0x52a784a32fa9583446569576e30d9d9bfa595497d75e61a3f65bdcf9d230a402",
  "0x4824f1422e30e71a901878b278080cece44d1b2b40189043c4b116e4ca855537",
  "0x886ddfaf8992758ab419dc065e40edfcb133cb139f06ce7617be577967bc9b53",
  "0x02b8f58a9981c443b4c5e53d8c6bd1996a9b463dd70aa91000775f3c1b70c033",
  "0xa0a4bc2f061a244eba93903cb12337cb20091f446843a3ec6536a2a5995d5b34",
  "0x3c18c38660d93a14566e9fbee73daf7aabb68c4c2f1f995128820dc339f2fb10",
  "0xf6a600bd091432d17e45b00be6cbb2798292720b99d307cd6f3302fd6d23384b",
  "0x62b2b479d642489344c5eeb9cea6a9041e4077d9cefb49fc2112b8a0a0a7c970",
  "0x4a05d374686e7b478032d9882e1bf70d8755b032c64368a3dba652111b0daf17",
  "0xe05ec43a0429ee90192c93fb67b2f628d3f3c512145f5718f86741863d790731",
  "0xd04f8cb89c4fb6d5c00cfc7422ca02136d76eede6481ba37a5ee5165a7a9ea46",
  "0x72aaa1205b277333c348c13df9c5a0b8dbd1baa34ed05f8ed4ca8a9afa8f6d16",
  "0x68ad70f1659d8dd180c07fb6d617ce6cb4662eebaea7a4141efa55c18250ad20",
  "0xe06c509a7db6efd3c3640e5e158b2992e448f4050202951c8db0f182a637811f",
  "0x240b0bbb9d279ec3321bfcc7c554bde85b7eeb110671f55a0085c65956924258",
  "0x286ce6ff5969ebe560b1625b4787d7fe2a976e3881c81f8b8e23c29fc194e756",
  "0x568f184f52581f7041be44beedef5ca4cb30ee23af78cb74c92a7884ef5bdf27",
  "0x60346128a8a0f1b883d337b4d9ffd76de29be6845753ff75a555b258e1e31d40",
  "0x78c3acdeb74095cfaed6397b4b4da8899605ea794ac582d972adf2bccee64d78",
  "0xb0132038a8095702a38c8782c650c3df2cbbf220f6a853551e9e065531992d1a",
  "0x04169c50aa186051e0f44b72afc54b5b70c23523cc1ea836628d0c5b2b529749",
  "0x1aace2f562d98ea09e0b4ef1ac3aa30d4583d7f4d11f529fc97496bdf34c952c",
  "0xda3dd3ef7ebae56cf8e93c6b50b88b3fac356bf88d158654352960e857c7561b",
  "0xe2824830ea1ca3c55f4d72c6124b05525887648637146c80c48ecbcedd1f2e4a",
  "0x6614dc92530ea0d5d57e88bc59d16fac5fb5d6cc05aff2001f0d79aae0eb467b",
  "0x96dc4eb4003d027f7ba6cd12ae79f0772640161ece481078e38f8499c9f15d41",
  "0xb24cdba43aebcadb05a7b1f9855d53a213a1db6e80271c1d2e13980eca492d02",
  "0x1693b055cc9f58bf5fec8265e34003d9d5a7559ccdf080771aa639f6989cd93b",
  "0x26d8c28763462e9f040ecf9acd320fdee95813ee07d00ab065011fd0ba75e31b",
  "0x26d4a8b6f7c7c15775f61c0c9c3c3befd57246ed0a1c6b8e0d3996415b173651",
  "0xb8c76ad8ad2cae3a561af7495c1569931c5730ba484cc0f8eecb39afb61c5915",
  "0x1c202105530444cc65a4d208f3929241beba7d64bd009a1269739cf8636d996d",
  "0xfc4800d15685ac412efd98e8a75adf84836ce6ac1a5b4552ce042dac24d97f25",
  "0x96275058ec27c9054f1c9a567c53a0d487af558cbf1db0149cf39aa2e0157c5d",
  "0xb8930df60aaaeaa63aea3b02608bc2d421911497f8ad16a6f78f6d18d547322f",
  "0xbcdc7790846e0a0b5df32b9b6d22c859eb61634f53cedcfe91d3c72e0c1d8169",
  "0xa4d2d9b46c4b3b62def7a04ed1137705807cde17ce1497ddd20e1024a5d0a750",
  "0xc8ae69c3d334803937e07042aea49aed8eb8b8d6bd0749e28a7e69b2cd1b1254",
  "0xb2af65f12503c15f74e10e58440826dca704a7525c6889d9c1d0c2579c018f1e",
  "0x2e72c52d49b28bcc07692ec4ea447782e00b3b5afaf9a6e137ddcd88098a2f16",
  "0x26d53069bc97a92f44db2048c40ae21137b283662f0b3b9d43970d375a967d51",
  "0x6686c28c84f4fad4be57907bd5401693e9d80d1e4b005e95e377c7fc5586a564",
  "0x1e51a3b6feb63a45e5fe6feba9cb68a9747bed6528fe5ed84cc6811f93249612",
  "0x4ce3c91215eb4a1f253f7f1c81ae2d0e565b9586360cfdfc3b1ea844b6fb200f",
  "0xb2e5c77c6e5e7548412a37ab7655ddbdefca8e146973aa2345230fb2bf18733c",
  "0x5c99ecd25e9b0ca7e4073ec2258eb5db2a68d0af5157bbb96bfa0df9b5dafc42",
  "0xc0e250e6bf27c47d182cf21df46cb4f76a53e760550e41fcafad16fe720ae24d",
  "0x28434656f1792dd2158faadaff6b6a2bc45fb28865ec45819007feaf8b158c21",
  "0x78528b9c16645bfb2f318bc822e82559ecf58eb0b61ff0a638b308b4d2681a27",
  "0x369fa3a2ef3b753f5f0bedc983c0fd106bb6c51cdafb4599f2c7dceb457a5269",
  "0x6acdf347f63e10c89152795f1afdae966b5efd42b3273f9b174ba27dac873f1c",
  "0x70c069dc8f91c3d363b1683f806df917d11ba76bf630bdf6b4c52408e4c42716",
  "0xdc0fdb23730e3e49a87102e475889e3a858e7362655db3e1db8d12f222862e76",
  "0x8c29b5ac7c866c564909fb28bce6d73ee9d17ce7e5b12432097ce7dde1277d2e",
  "0x8a4c8295dc1b7de007a49a04ed44c1d390b1b0be9669efc74a94f102f87fc05f",
  "0xe4e434bdba5c9e7bcba737cd0a78a573b4424bf5ad188a0b9062909e6a841c45",
  "0xd0495a5322cc2e2a5db22d9c9f71c760505efb804226419079b0b11b341c5168",
  "0xdacc8b87a93d50cc4ebe09f362d93d12297f3469a2010e289ddf40014bf88f67",
  "0x9803f4c198784f3d30d8f6cbcfdf92b88664cf55d48f70301840af2dd328104a",
  "0x8cb440280b068bc95b4a6d6a87da745d99922aa84967ea6e1197777e51ad912b",
  "0x74b0398e8a9ce6c887a68907e8acbe1c756eaa21575199920f1168177fc7cd76",
  "0x7653c1196819b95481a92ef49a570396216089a09ebe652ddd8d4381df947e46",
  "0xf24a71474fc6457db81bed711f5b22529b5dc1ce34f13fa14e5cb3940c50674a",
  "0x96098e85cf8bdc90adaa76af9950b4b406261f657c8b8d9a30731132ff98ff4e",
  "0x66d4fdbf897eda99892ad5cd956e445c74427811dd30b88911225b7ae933820e",
  "0x58bd8adb8887a0d84eca86643c7c2d36b62ed5b22ade9e72eeb309bf38a7536f",
  "0xccc78b3198270edb178251358caf3849d9da020a9ccd8212c214848a635dbf7d",
  "0xd8cff56007a8167d407c4d8ba03b5624a350ad64541325ab646c307e2d8a0240",
  "0x9265cd4e65cb8ff5691fa631f86f92d97df001692572c9e78a843242e24f3a12",
  "0x02d47f54be9303452612833f265c87b90cae084513693cdfce4b38a03c322856",
  "0xa60371fd26387ad465fbfec6421627ac3a88582ccc19303dce1e3d3e23851342",
  "0x2a83cfba5f1a75cfd71e179986e8f9ffdf4662416cdf666d5ca68a89afa70402",
  "0x0469a3bd59e9fc6634ee6f3980bb00ba0d2c024c9482112749dfb41226de7449",
  "0xc0a2a79a34608c08cee806755bd2eda969c1414d55d33277ba9f778f0e2de53d",
  "0x18a2aaada85261242cca471f172e642c7aacd7bfb36b4bbd9429ed9becd8357c",
  "0x1ce645681fdd31cf96edd14f5cc12e777648b9d716c8f685de6171dcf8dbf459",
  "0x5a91e64453fc596e8fc4dd68ddf06e9304f319d88d536a998d852c459bbf3b13",
  "0x34a87f9ac9c9456e3657a981edf8663bb0e6a947e0464d709af013f7c8ea007d",
  "0x88e935291bc4939d9bd67de837ea37792427e3bb3d2ed52be5e6985bf2e89200",
  "0x3aca7b7dbb5d19b1b4de64a5bac88f04491a95026c53b35960d852bce0402847",
  "0x909f89c9de77e71cbe06d1e4720db6b673696fb1bb6d3e821085d7d54d5bae1e",
  "0xfe21c181f9aa44ce5e8c3466eee31fd23698744c9b94098f6d9a383ed5d7dc31",
  "0xd4a1b985d90004babe076470df8ec57f67ec4d60503ce4a298123523c7546e0d",
  "0x54166aa8908493ce4e07add7c1efa30946dfdf9a81e276bb8b3939dcad054126",
  "0xb24020751af8d66c2938a6b6e5a36d19b823c583cc315df2a14b20a75637b12a",
  "0xa8a23bdf0bb221d1d1a53dcddf20dd8155ae7e63470e3859c207781f65bee944",
  "0x86448da5c43b4a4a50428bf043d76646f783b0044176904d356cd50935d0347a",
  "0xd650b2abb89931114d69d2ad00f599283cdf4777831744ab54146c67d4a0ac36",
  "0x8c1136dc09815c7c3f450f5026bc7313ef04258cdb4322d2d120d54d3b02301b",
  "0x7e67c748bb564e20ee02825e7334e50b6b43da23b40697d43ee3cb319fe62f05",
  "0xb0f9abd1946be085bd5fd3e8c5343e1ad0d4ee27cdedafd8375e78efaec6516a",
  "0xc07ce531e9f50aad590e01975599f644905839bba07263a3ad94a5b04cc4727c",
  "0xc221f3979e9a36b42b4ee4952c7b9003812bcc0fdb63e1a2c345d6137a2cdf4c",
  "0x042384d21bd26e250d199ed62c3dadf259c5df0308e056efdafab20e14e73d51",
  "0x4664de640ea5047a8e30548f85c4fc77df716e53d97f7a032bd342c242dc5424",
  "0xec51cbbbcc288ea76abbb3f85adfc0e392f43dcf8fc9c728b2b5b2d059fc1967",
  "0x7ae912bdf8c19a785faf4d8c134647e8892b509f11a5d5b1e47b68f217c54a06",
  "0x00e4d332ad83800701c72bfe22686e2b6528a7897b902cee65e5899279758a1e",
  "0x068637b2e22b55e32bc7daf91f801162016fae8305756123584037d4f679e00c",
  "0xfc3beb911ed25206e3ddb03ef1805c5312ed05c922e997c9a7aa66bdc728c131",
  "0xf0fceeb37ac7f29ffaad151ed3b014e8b0defef75e809d2e89742be1e9288a31",
  "0xd6276aacca5726d61b4e82041f51475d0d54290dc8c974f1f165438a47ea5c45",
  "0x50565ef28d375fd8f5a60e546b8683663ae9d053a71d88c2e16ef66ef93a454e",
  "0xa4e33ff0a52c922fe5642dcf22054441c8eb68196f7e10055f3381b405b0ca50",
  "0xaec27525939ca02fd847d42a42ed8130d0b81ab95c30e40e84c0364c80079273",
  "0xfecd47424ef198d4696c716ade1a856d51f75bba7407208609de61c40a59c617",
  "0x2690be653d47a8c8f59843b4cd428c7aea731cbf2770fb9e94bbba52a0cb196d",
  "0x7efbf656afae3526783ddc189e88d1cdc45e14dc7fbb60908b0378263668f15e",
  "0xc4e4df6c4c231ad1de18493eb8b43e9babfa78ebf7286cff9d4d33e90e11080d",
  "0x6053b8899c007e05035106046cce61f1f1cccd7e872b3e7f4d61e74056bec863",
  "0x7ca63b60bdfda9ec2ffd9e08a5986f4872070e374c1c7875ad38ff336aef0a06",
  "0x844f4155ba187dcf3d7f4a1c49be66b9dbd57be54e114621e1edf3bc7418e116",
  "0xdee4379f6fc5c9547723f551fab167f1d7138bdc16d1c7bd6ee67642af246714",
  "0x3e9faa00b5aefba8117248671dc2660ee041dca8fee2a9821e5244e99254e113",
  "0xc6831eb102ddc26102e3b281a1a4fdba37d6af2c6367d0e8c8b1f40ec6d59a1f",
  "0xb2f8a814ff817f0dd88755f083e25fc6357bd6fe589cb1d56864ffb9802e207a",
  "0x2088e2790a3f96c0608001f034faced8f7df89fd802b579c083e36a5d5cf7424",
  "0x8a89850d247c106182a9a25ea460595b987823b597b6356d42223835101b564f",
  "0x340c9f0e675b5bdfaefe430f9e841bb546049bd74607cbd176fa0884d7c6e050",
  "0x6094635f559c5d094dac3f48b2db56adf325720a4653f20467fc28ddcd2bb57f",
  "0x20b54a0d6c61bc1bec7efd43bdef12ce2e5b6594dba0a14c1075b981c869371e",
  "0xb6cc2edcb04aa3ecf0fac6f3df182acda04447a75c20501a09c7a53a14b10759",
  "0xbae2ec7be2739aee27cac82b70976efb6029bec1a00a168c6dd77b056cc1b928",
  "0x96570936e0b909f2346fbdab48ba1af2240835c951051825275f9b24ef8fa67c",
  "0xe4c607be3d5e828be6d966a3a05a861662baeaf9cd6ddde1263d40c9cff7480f",
  "0xc4b6cbdd63bb4ef9f87931ed4c6504c4d5142bbe7970164144f58f379196901e",
  "0x00547672b7e364d9747dd598d6469b2390588fa67246a08cd663a7f97a04b036",
  "0x1aaa5c13e9912523fefc5b62fee960704b17ed2108b50a990c4f2bb4b8028436",
  "0x1a3d84ca2c8e6d19bb29f096cd6116f4424cdd96fef73badf181a5ac03a1b706",
  "0xaa80a5a5124eccd1ec4d8abd86289be44d2eee9062efdf14bed94eed687c0132",
  "0x464643bb6830d5ec8da54c16a8b88b49d3066a48abdc6b610857c7760a17ef32",
  "0xfce5044c6b5b6a124f25bbde15a7f73979dab6881c1b66155a9687f7650fc131",
  "0x44bf158f52b4876c27ed6cca6edcfbca9632e033985286199c3530cf7fc1df12",
  "0xf6e20a792525a5d6bdf1a7ac6624fce9dc8273ec21cb89015e08f5a7dc840c3a",
  "0x527a4a4c274b8a17c7672f9b860998be14ac763334514fd5ba384bd81eb1e155",
  "0xe0cbc959503a6d68b3576474355de0a73ba51e71261f1405c8b827bb9d6f8135",
  "0xd43b0621b9a57d1595b92aa9e43e57d9c417b4dea1b314ee16119a7fdfe0c06f",
  "0xbe0ee6b6a5a34be356bdec3610c0e1c2048536b64d1bc2452171b01e390da50a",
  "0xf649d0e3d1c89dc17c712061573cac34c2acbc4d2d36d82abd9914f8aa0d747b",
  "0x8ad76cd6e4f14ab3bb70da26ff7a1e3717d2935c93bfb45791db1849cc40a728",
  "0x124ba56acfa650a4e0862d2b15e482a614f5d568a31495826582be8f549c1f34",
  "0x629c360b620a99b0705423b81bba1734f3011cb364d938cbd1a79f6b5329906e",
  "0x8a13cc8b0f9324ea22b76636be862dc7c522075e9e96a25fbc393f0deda7033d",
  "0xc47827499fd796e6e339be5a582b639ad487916f05471b77343bb97145b1a92f",
  "0x3229eebfd03610b9e6a3932cd953293c27e80b8225ea6fc580fb46be8408a430",
  "0xb063d754602f22a3ac2af01ebdb2140357e3ca3d102e55a4d44a751fcb03b040",
  "0x6628b623e2a9b795b57f8dc91c5718b7b63722e1ee617030845a967ff0c8c72e",
  "0x9099308d294e320e001d567b21cee3177d149da08a2f3e7534e7f369d93f4e5e",
  "0xfc4fbd48eaf9bbb566486e74500cdef3dcd6482afc31f4d7aec95c4bf0537d30",

  // PoC6
  '0xac5087e0e21de2b2637511e6710db74e5ec2dbc3f02db76ffa02662878ecf333',
]

interface WorkerInfo {
  id: string
  endpoint: {
    default: string
    v1: string[]
  }
}

export const availableWorkerQueryAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  const clusterId = get(currentClusterIdAtom)
  return {
    queryKey: ['workers', clusterId],
    queryFn: async () => {
      const lstQuery = await api.query.phalaPhatContracts.clusterWorkers(clusterId)
      const workerKeys = lstQuery.toJSON() as string[]
      // @ts-ignore
      const endpoints: {v1: string[]}[] = (await api.query.phalaRegistry.endpoints.multi(workerKeys)).map(i => i.toJSON())
      const workers = R.map(
        ([workerId, endpointInfo]) => {
          return [
            (workerId as string),
            {
              id: workerId,
              endpoint: {
                default: R.head(endpointInfo?.v1 || []),
                v1: endpointInfo?.v1 || [],
              }
            }
          ]
        },
        R.zip(workerKeys, endpoints)
      ) as [string, WorkerInfo][]
      return [workerKeys, R.fromPairs(workers)] as const
    },
  }
})

export const availableWorkerListAtom = atom(get => {
  const [workers, ] = get(availableWorkerQueryAtom)
  return R.difference(workers, ExcludedWorkers)
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// PRuntime
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const DEFAULT_ENDPOINT = 'https://poc6.phala.network/pruntime/0x923462b4'

export const userSelectedPruntimeAtom = atomWithStorage<Record<string, string>>('user-selected-pruntime', {})

export const pruntimeURLAtom = atom(
  get => {
    const rec = get(userSelectedPruntimeAtom)
    const endpoint = get(endpointAtom)
    if (rec[endpoint]) {
      return rec[endpoint]
    }
    const currentWorkerId = get(currentWorkerIdAtom)
    if (!currentWorkerId) {
      return DEFAULT_ENDPOINT
    }
    const [, workers] = get(availableWorkerQueryAtom)
    const worker = workers[currentWorkerId]
    return worker.endpoint.default || DEFAULT_ENDPOINT
  },
  (get, set, value: string) => {
    const endpoint = get(endpointAtom)
    const rec = get(userSelectedPruntimeAtom)
    set(userSelectedPruntimeAtom, {...rec, [endpoint]: value})
  }
)

export const pruntimeListQueryAtom = atomWithQuery(get => {
  const api = get(apiPromiseAtom)
  const workerId = get(currentWorkerIdAtom)
  return {
    queryKey: ['phalaPhatContracts.endpoints', workerId],
    queryFn: async (ctx) => {
      const { queryKey: [, workerId ]} = ctx
      const result = await api.query.phalaRegistry.endpoints.entries()
      const transformed: Pairs<string, EndpointInfo>[] = result.map(([storageKey, value]) => {
        const keys = storageKey.toHuman() as string[]
        return [keys[0], value.unwrap().toHuman()]
      })
      if (workerId) {
        return R.filter(i =>i[0] === workerId, transformed)
      }
      return transformed
    },
    staleTime: ms('5m'),
  }
})

export const availablePruntimeListAtom = atom(get => {
  const result = get(pruntimeListQueryAtom)
  if (result) {
    return R.pathOr([], [0, 1, 'V1'], result)
  }
  return []
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Cert
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const cachedCertAtom = atom<Pairs<string, CertificateData | null>>(['', null])

export const hasCertAtom = atom(get => {
  const current = get(cachedCertAtom)
  const account = get(currentAccountAtom)
  return account?.address === current[0] && current[1] !== null
})

export function useRequestSign() {
  const [isWaiting, setIsWaiting] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const api = useAtomValue(apiPromiseAtom)
  const account = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)
  const [cachedCert, setCachedCert] = useAtom(cachedCertAtom)

  useEffect(() => {
    if (api && account && signer) {
      setIsReady(true)
    } else {
      setIsReady(false)
    }
  }, [setIsReady, api, account, signer])

  const requestSign = useCallback(async () => {
    if (!account) {
      throw new Error('You need connected to an endpoint & pick a account first.')
    }
    if (!signer) {
      throw new Error('Unexpected Error: you might not approve the access to the wallet extension or the wallet extension initialization failed.')
    }
    try {
      setIsWaiting(true)
      const cert = await signCertificate({ signer, account })
      setCachedCert([account.address, cert])
      return cert
    } catch (err) {
      return null
    } finally {
      setIsWaiting(false)
    }
  }, [account, signer, setIsWaiting, setCachedCert])

  const getCert = useCallback(async () => {
    if (account?.address === cachedCert[0] && cachedCert[1] !== null) {
      return cachedCert[1]
    }
    return await requestSign()
  }, [cachedCert, account, requestSign])

  const hasCert = useMemo(() => {
    return account?.address === cachedCert[0] && cachedCert[1] !== null
  }, [cachedCert, account])

  return { isReady, isWaiting, requestSign, getCert, hasCert }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Registry
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const endpoints = [
  {
    pruntimeURL: 'https://phat-cluster-de.phala.network/pruntime-01',
    workerId:
      '0xe028af412138fe0a31ab0b3671243bdbe19d1a164837b04e7d8d355091fcd844',
  },
  {
    pruntimeURL: 'https://phat-cluster-de.phala.network/pruntime-03',
    workerId:
      'b063d754602f22a3ac2af01ebdb2140357e3ca3d102e55a4d44a751fcb03b040',
  },
  {
    pruntimeURL: 'https://phat-cluster-de.phala.network/pruntime-04',
    workerId:
      '6628b623e2a9b795b57f8dc91c5718b7b63722e1ee617030845a967ff0c8c72e',
  },
  {
    pruntimeURL: 'https://phat-cluster-de.phala.network/pruntime-05',
    workerId:
      '9099308d294e320e001d567b21cee3177d149da08a2f3e7534e7f369d93f4e5e',
  },
]

export const phatRegistryAtom = atom(async (get) => {
  const api = get(apiPromiseAtom)
  const endpoint = get(endpointAtom)
  const clusterId = get(currentClusterIdAtom)
  const workerId = get(currentWorkerIdAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  // Hotfix for production
  if (endpoint === 'wss://api.phala.network') {
    const picked = endpoints[Math.floor(Math.random() * endpoints.length)]
    const cluster_id = '0x0000000000000000000000000000000000000000000000000000000000000001'
    const system_contract_id = '0x9dc2f09872e69f622cedbb3743aea482c740d9973f30f45c26cb8ed9782e6ab2'
    return await OnChainRegistry.create(api, {
      ...picked,
      clusterId: cluster_id,
      systemContractId: system_contract_id,
      skipCheck: true,
    })
  }
  const registry = await OnChainRegistry.create(api, { clusterId, workerId, pruntimeURL })
  return registry
})

export const pinkLoggerAtom = atom(async (get) => {
  const api = get(apiPromiseAtom)
  const registry = get(phatRegistryAtom)
  if (!registry.systemContract) {
    return null
  }
  try {
    const pinkLogger = await PinkLoggerContractPromise.create(api, registry, registry.systemContract)
    return pinkLogger
  } catch (err) {
    console.error('PinkLogger initialization failed: ', err)
    return null
  }
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// System Contract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const currentSystemContractIdAtom = atom(get => {
  const clusterInfo = get(currentClusterAtom)
  if (clusterInfo) {
    return clusterInfo.systemContract
  }
  return null
})

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Sidevm Contract / Pink Logger Cotnract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const pinkLoggerResultAtom = atom<SerMessage[]>([])

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
//  Current Contract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

interface ContractLookupFailed {
  contractId: string
  codeHash: string | null
  deployer: string | null
  found: false
  verified: false
  cached: boolean
  metadata?: ContractMetadata
}

interface ContractLookupSucceed {
  contractId: string
  codeHash: string
  deployer: string | null
  found: true
  verified: boolean
  cached: boolean
  source?: 'Patron' | 'Phala'
  metadata?: ContractMetadata
}

export type ContractLookupResult = ContractLookupSucceed | ContractLookupFailed

function unsafeFetchMetadataProgressive(deps: { registry: OnChainRegistry, localCachedContracts: Record<ContractKey, LocalContractInfo> }) {
  const { registry, localCachedContracts } = deps

  return async function _unsafeFetchedMetadataProgressive(contractId: string): Promise<ContractLookupResult> {
    const contractInfo = await registry.api.query.phalaPhatContracts.contracts(contractId)
    const deployer =contractInfo.isSome ? contractInfo.unwrap().deployer.toString() : null
    const localMetadata = localCachedContracts[contractId]

    const cached = !!(localMetadata && localMetadata.metadata.source.hash)

    // TODO Error handling
    const codeHash = await unsafeGetContractCodeHash(registry, contractId)
    if (!codeHash) {
      return {
        contractId: contractId,
        codeHash,
        deployer,
        found: false,
        verified: false,
        cached,
      }
    }
    // TODO use react-query here?
    const selfhostAbi = await TE.tryCatch(() => unsafeGetAbiFromGitHubRepoByCodeHash(codeHash), R.always(null))()
    if (isRight(selfhostAbi)) {
      return {
        contractId: contractId,
        codeHash,
        deployer,
        found: true,
        verified: true,
        cached,
        metadata: localMetadata?.metadata || selfhostAbi.right as ContractMetadata,
        source: 'Phala',
      }
    }
    return {
      contractId: contractId,
      codeHash,
      deployer,
      found: true,
      verified: false,
      metadata: localMetadata?.metadata,
      cached,
    }
  }
}

export const currentContractIdAtom = atom('')

export const currentMethodAtom = atom<ContractMetaMessage | null>(null)

export const currentContractAtom = atom(get => {
  const contractId = get(currentContractIdAtom)
  const contracts = get(localContractsAtom)
  return contracts[contractId]
})

export const currentContractV2Atom = atom(async (get) => {
  console.warn('deprecated: use `contractInfoAtomFamily` instead')
  const contractId = get(currentContractIdAtom)
  const registry = get(phatRegistryAtom)
  const localCachedContracts = get(localContractsAtom)
  const result = await unsafeFetchMetadataProgressive({ registry, localCachedContracts })(contractId)
  return result
})

export const currentAbiAtom = atom(get => {
  const contract = get(currentContractV2Atom)
  if (!contract || !contract.metadata) {
    return null
  }
  const abi = new Abi(contract.metadata)
  return abi
})

export const messagesAtom = atom(get => {
  const contract = get(currentContractV2Atom)
  if (!contract || !contract.metadata) {
    return []
  }
  if (contract.metadata.V3) {
    return contract.metadata.V3.spec.messages || []
  }
  return contract.metadata.spec.messages || []
})

export const contractInstanceAtom = atom<ContractPromise | null>(null)

export const resultsAtom = atomWithReset<ContractExecuteResult[]>([])

export const dispatchResultsAtom = atom(null, (get, set, result: ContractExecuteResult) => {
  const prev = get(resultsAtom)
  set(resultsAtom, [ result, ...prev ])
})

export const instantiateTimeoutAtom = atom(60)

//

export interface EstimateGasResult {
  gasLimit: u64
  storageDepositLimit: BN | null
}

export type ContractInfo = ContractLookupResult & {
  canExport: boolean
  isFetching: boolean
  stakes: number
}

type FetchAction = { type: 'fetch' }
type EstimateAction = { type: 'estimate', method: ContractMetaMessage, args?: Record<string, any> }
type ExecAction = {
  type: 'exec',
  method: ContractMetaMessage,
  args?: Record<string, any>,
  cert: any,
  depositSettings:  DepositSettingsValue,
  value?: number | bigint | BN | null
}
type ExportAction = { type: 'export' }
type StakeAction = { type: 'stake', value: string }

export type ContractInfoActions = FetchAction | EstimateAction | ExecAction | ExportAction | StakeAction

export interface ContractInfoDispatch {
  (action: FetchAction): Promise<ContractLookupResult>
  (action: EstimateAction): Promise<EstimateGasResult>
  (action: ContractInfoActions): Promise<any>
}

type Getter = {
    <Value>(atom: Atom<Value | Promise<Value>>): Value;
    <Value>(atom: Atom<Promise<Value>>): Value;
    <Value>(atom: Atom<Value>): Awaited<Value>;
};

type WriteGetter = Getter & {
    <Value>(atom: Atom<Value | Promise<Value>>, options: {
        unstable_promise: true;
    }): Promise<Value> | Value;
    <Value>(atom: Atom<Promise<Value>>, options: {
        unstable_promise: true;
    }): Promise<Value> | Value;
    <Value>(atom: Atom<Value>, options: {
        unstable_promise: true;
    }): Promise<Awaited<Value>> | Awaited<Value>;
};

type Setter = {
    <Value, Result extends void | Promise<void>>(atom: WritableAtom<Value, undefined, Result>): Result;
    <Value, Update, Result extends void | Promise<void>>(atom: WritableAtom<Value, Update, Result>, update: Update): Result;
};

type ContractInfoWrite = {
  (get: WriteGetter, set: Setter, update: ContractInfoActions): Promise<void>
  (get: WriteGetter, set: Setter, update: FetchAction): Promise<ContractLookupResult>
  (get: WriteGetter, set: Setter, update: EstimateAction): Promise<EstimateGasResult>
}

interface ContractInfoAtom extends WritableAtom<ContractInfo | null, ContractInfoActions> {
  write: ContractInfoWrite
  onMount: (setAtom: SetAtom<ContractInfoActions, void>) => void
}

//

async function estimateGas(contract: PinkContractPromise, method: string, cert: CertificateData, args: unknown[]) {
  const { gasRequired, storageDeposit } = await contract.query[method](cert.address, { cert }, ...args)
  const options: EstimateGasResult = {
      gasLimit: (gasRequired as any).refTime,
      storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null
  }
  return options
}

export const contractInfoAtomFamily = atomFamily(
  (contractId: string | null) => {
    const localStoreAtom = atom<ContractLookupResult | null>(null)

    const isFetchingAtom = atom(false)

    const contractInstanceAtom = atom<PinkContractPromise | null>(null)

    const availableMethodsAtom = atom<Record<string, any>>({})

    const contractTotalStakesAtom = atomWithQuerySubscription<number>((_get, api, subject) => {
      const multiplier = new Decimal(10).pow(api.registry.chainDecimals[0])
      if (contractId) {
        return api.query.phalaPhatTokenomic.contractTotalStakes(contractId, (stakes) => {
          const value = new Decimal(stakes.toString()).div(multiplier)
          subject.next(value.toNumber())
        })
      }
    })

    const theAtom: ContractInfoAtom = atom(
      get => {
        const lookupResult = get(localStoreAtom)
        return {
          ...lookupResult || {},
          canExport: !!(lookupResult?.found && lookupResult?.metadata),
          isFetching: get(isFetchingAtom),
          stakes: get(contractTotalStakesAtom),
        }
      },

      async (get: WriteGetter, set: Setter, action: ContractInfoActions) => {
        if (!contractId) {
          return
        }
        //
        // Fetch Info
        //
        if (action.type === 'fetch') {
          set(isFetchingAtom, true)
          const registry = get(phatRegistryAtom)
          const localCachedContracts = get(localContractsAtom)
          const result = await unsafeFetchMetadataProgressive({ registry, localCachedContracts })(contractId)
          set(localStoreAtom, result)
          if (result.metadata) {
            const contractKey = await registry.getContractKeyOrFail(contractId)
            const contractInstance = new PinkContractPromise(registry.api, registry, result.metadata, contractId, contractKey)
            set(contractInstanceAtom, contractInstance)

            const methods = R.fromPairs(R.map(
              i => [i.meta.identifier, i.meta.method],
              R.values(contractInstance.query || {})
            ))
            set(availableMethodsAtom, methods)
          }
          set(isFetchingAtom, false)
          return result
        }

        //
        // Export
        //
        if (action.type === 'export') {
          const fetched = get(localStoreAtom)
          if (!fetched || !fetched.metadata) {
            return
          }
          const meta = fetched.metadata
          // @ts-ignore
          meta.phat = { contractId: fetched.contractId }
          var element = document.createElement('a');
          element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(meta)));
          element.setAttribute('download', `${fetched.metadata.contract.name}.json`);
          element.style.display = 'none';
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
          return
        }

        //
        // Staking
        //
        if (action.type === 'stake') {
          // set(isSavingAtom, true)
          const api = get(apiPromiseAtom)
          const account = get(currentAccountAtom)
          const signer = get(signerAtom)
          const theNumber = new Decimal(action.value).mul(new Decimal(10).pow(api.registry.chainDecimals[0]))
          if (account && signer) {
            // @ts-ignore
            await signAndSend(api.tx.phalaPhatTokenomic.adjustStake(contractId, theNumber.toString()), account.address, signer)
          }
          return
        }

        //
        // Preparation for estimate & exec action
        //
        const api = get(apiPromiseAtom)
        const account = get(currentAccountAtom)
        const signer = get(signerAtom)
        const contractInstance = get(contractInstanceAtom)
        const info = get(localStoreAtom)
        const pinkLogger = get(pinkLoggerAtom)
        const aliceCert = get(aliceCertAtom)
        if (!api || !account || !signer) {
          throw new Error('Please connect to an endpoint & pick a account first.')
        }
        if (!contractInstance) {
          throw new Error("Please can `{ type: 'fetch' }` first.")
        }
        const methodSpec = action.method
        const methods = get(availableMethodsAtom)
        if (!methods[methodSpec.label]) {
          return
        }
        const name = methods[methodSpec.label]
        const abiArgs = R.find(i => i.identifier === methodSpec.label, contractInstance.abi.messages)
        // const inputs = actions.args || {}
        const args = R.map(
          ([arg, abiArg]) => {
            const value = (action.args || {})[arg.label]
            // Because the Text will try convert string prefix with `0x` to hex string, so we need to
            // find a way to bypass that.
            // @see: https://github.com/polkadot-js/api/blob/3d2307f12a7b82abcffb7dbcaac4a6ec6f9fee9d/packages/types-codec/src/native/Text.ts#L36
            if (abiArg.type.type === 'Text') {
              return api.createType('Text', { toString: () => (value as string) })
            }
            try {
              return api.createType(abiArg.type.type, value)
            } catch (err) {
              return value
            }
          },
          R.zip(methodSpec.args, abiArgs!.args)
        ) as unknown[]
        const inputValues: Record<string, unknown> = {}

        if (action.type === 'estimate') {
          const txConf = await estimateGas(contractInstance, name, aliceCert, args);
          return txConf
        }

        if (action.type === 'exec') {
          try {
            if (methodSpec.mutates) {
              if (action.depositSettings.autoDeposit) {
                const options: PinkContractSendOptions = {
                    cert: action.cert,
                    signer,
                    address: account.address,
                }
                if (action.value) {
                  options.value = action.value
                }
                const result = await contractInstance.send[name](
                  options,
                  ...args
                )
                set(dispatchEventAtom, result.events as unknown)
              } else {
                const { gasLimit, storageDepositLimit } = R.pick(['gasLimit', 'storageDepositLimit'], action.depositSettings)
                if (!gasLimit) {
                  throw new Error('Please input gas limit')
                }
                const result = await signAndSend(
                  contractInstance.tx[name]({ gasLimit, storageDepositLimit }, ...args),
                  account.address,
                  signer
                )
                set(dispatchEventAtom, result.events as unknown)
                // debug('manual deposit: ', txConf)
              }
            } else {
              const queryResult = await contractInstance.query[name](
                account.address,
                { cert: action.cert },
                ...args
              )
              if (queryResult.result.isOk) {
                set(dispatchResultsAtom, {
                  contract: info as LocalContractInfo,
                  methodSpec,
                  succeed: true,
                  args: inputValues,
                  output: queryResult.output?.toHuman(),
                  completedAt: Date.now(),
                })
              } else {
                set(dispatchResultsAtom, {
                  contract: info as LocalContractInfo,
                  methodSpec,
                  succeed: false,
                  args: inputValues,
                  output: queryResult.result.toHuman(),
                  completedAt: Date.now(),
                })
              }
            }
          } catch (error) {
            // debug('Execute error', error)
            // toast({
            //   title: `Something error`,
            //   description: `${error}`,
            //   status: 'error',
            //   isClosable: true,
            // })
          } finally {
            if (pinkLogger) {
              try {
                const { records } = await pinkLogger.tail(1000, { contract: contractId })
                set(pinkLoggerResultAtom, records)
              } catch (err) {
                console.log('get log error', err)
              }
            }
          }
        }
      }
    )
    theAtom.onMount = (set) => {
      if (contractId) {
        set({ type: 'fetch' })
      }
    }
    return theAtom
  }
)

export function useContractInfoAtom(contractId: string | null) {
  return useMemo(() => contractInfoAtomFamily(contractId), [contractId])
}

//
// Guest Pairs & Guest Cert, we use `//Alice` here.
//

export const alicePairAtom = atom(() => {
  const keyring = new Keyring({ type: 'sr25519' })
  return keyring.addFromUri('//Alice')
})

export const aliceCertAtom = atom(async (get) => {
  const pair = get(alicePairAtom)
  return await signCertificate({ pair })
})