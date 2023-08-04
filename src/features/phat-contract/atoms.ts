import type { ContractPromise } from '@polkadot/api-contract'
import type { AnyJson, Codec } from '@polkadot/types/types'
import type { Option } from '@polkadot/types'

import { isClosedBetaEnv } from '@/vite-env'
import { useMemo, useCallback, useEffect, useState } from 'react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { atomWithReset, atomWithStorage, loadable } from 'jotai/utils'
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
  unsafeGetAbiFromPatronByCodeHash,
  unsafeGetContractCodeHash,
} from '@phala/sdk'
import { validateHex } from '@phala/ink-validator'
import { isRight } from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'

import { apiPromiseAtom } from '@/features/parachain/atoms'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import { queryClusterList, queryEndpointList } from './queries'
import { endpointAtom } from '@/atoms/endpointsAtom'


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
  return queryClusterList(api)
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
      return rec[endpoint]
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
  "0xb2f8a814ff817f0dd88755f083e25fc6357bd6fe589cb1d56864ffb9802e207a",
  "0xbe0ee6b6a5a34be356bdec3610c0e1c2048536b64d1bc2452171b01e390da50a",
  "0x1ce645681fdd31cf96edd14f5cc12e777648b9d716c8f685de6171dcf8dbf459",
  "0xc07ce531e9f50aad590e01975599f644905839bba07263a3ad94a5b04cc4727c",
  "0x068637b2e22b55e32bc7daf91f801162016fae8305756123584037d4f679e00c",
  "0x02d47f54be9303452612833f265c87b90cae084513693cdfce4b38a03c322856",
  "0x8c1136dc09815c7c3f450f5026bc7313ef04258cdb4322d2d120d54d3b02301b",
  "0x4ce3c91215eb4a1f253f7f1c81ae2d0e565b9586360cfdfc3b1ea844b6fb200f",
  "0xd4a1b985d90004babe076470df8ec57f67ec4d60503ce4a298123523c7546e0d",
  "0xec51cbbbcc288ea76abbb3f85adfc0e392f43dcf8fc9c728b2b5b2d059fc1967",
  "0xe0cbc959503a6d68b3576474355de0a73ba51e71261f1405c8b827bb9d6f8135",
  "0xfc3beb911ed25206e3ddb03ef1805c5312ed05c922e997c9a7aa66bdc728c131",
  "0x02b8f58a9981c443b4c5e53d8c6bd1996a9b463dd70aa91000775f3c1b70c033",
  "0xaa80a5a5124eccd1ec4d8abd86289be44d2eee9062efdf14bed94eed687c0132",
  "0xd8cff56007a8167d407c4d8ba03b5624a350ad64541325ab646c307e2d8a0240",
  "0xfce5044c6b5b6a124f25bbde15a7f73979dab6881c1b66155a9687f7650fc131",
  "0xb0f9abd1946be085bd5fd3e8c5343e1ad0d4ee27cdedafd8375e78efaec6516a",
  "0x8ad76cd6e4f14ab3bb70da26ff7a1e3717d2935c93bfb45791db1849cc40a728",
  "0xd6276aacca5726d61b4e82041f51475d0d54290dc8c974f1f165438a47ea5c45",
  "0x527a4a4c274b8a17c7672f9b860998be14ac763334514fd5ba384bd81eb1e155",
  "0xa0a4bc2f061a244eba93903cb12337cb20091f446843a3ec6536a2a5995d5b34",
  "0x34a87f9ac9c9456e3657a981edf8663bb0e6a947e0464d709af013f7c8ea007d",
  "0x8c97086ea2755a79931445518e869e701aca8e9820e34ce80303d2f5993f512b",
  "0x844f4155ba187dcf3d7f4a1c49be66b9dbd57be54e114621e1edf3bc7418e116",
  "0x369fa3a2ef3b753f5f0bedc983c0fd106bb6c51cdafb4599f2c7dceb457a5269",
  "0x2088e2790a3f96c0608001f034faced8f7df89fd802b579c083e36a5d5cf7424",
  "0x042384d21bd26e250d199ed62c3dadf259c5df0308e056efdafab20e14e73d51",
  "0xf649d0e3d1c89dc17c712061573cac34c2acbc4d2d36d82abd9914f8aa0d747b",
  "0x124ba56acfa650a4e0862d2b15e482a614f5d568a31495826582be8f549c1f34",
  "0xb24020751af8d66c2938a6b6e5a36d19b823c583cc315df2a14b20a75637b12a",
  "0x00e4d332ad83800701c72bfe22686e2b6528a7897b902cee65e5899279758a1e",
  "0x7ca63b60bdfda9ec2ffd9e08a5986f4872070e374c1c7875ad38ff336aef0a06",
  "0x6614dc92530ea0d5d57e88bc59d16fac5fb5d6cc05aff2001f0d79aae0eb467b",
  "0x58bd8adb8887a0d84eca86643c7c2d36b62ed5b22ade9e72eeb309bf38a7536f",
  "0x7e67c748bb564e20ee02825e7334e50b6b43da23b40697d43ee3cb319fe62f05",
  "0x52a784a32fa9583446569576e30d9d9bfa595497d75e61a3f65bdcf9d230a402",
  "0xc4b6cbdd63bb4ef9f87931ed4c6504c4d5142bbe7970164144f58f379196901e",
  "0x6053b8899c007e05035106046cce61f1f1cccd7e872b3e7f4d61e74056bec863",
  "0x28434656f1792dd2158faadaff6b6a2bc45fb28865ec45819007feaf8b158c21",
  "0x4664de640ea5047a8e30548f85c4fc77df716e53d97f7a032bd342c242dc5424",
  "0xe4c607be3d5e828be6d966a3a05a861662baeaf9cd6ddde1263d40c9cff7480f",
  "0x88e935291bc4939d9bd67de837ea37792427e3bb3d2ed52be5e6985bf2e89200",
  "0x8a13cc8b0f9324ea22b76636be862dc7c522075e9e96a25fbc393f0deda7033d",
  "0x8c63ab05c5412c9016fb7c7efa80a750d37c12278ff02dafebf8985ee9f46127",
  "0xbcdc7790846e0a0b5df32b9b6d22c859eb61634f53cedcfe91d3c72e0c1d8169",
  "0x96275058ec27c9054f1c9a567c53a0d487af558cbf1db0149cf39aa2e0157c5d",
  "0x629c360b620a99b0705423b81bba1734f3011cb364d938cbd1a79f6b5329906e",
  "0xe26d870194dfd1b41d53aba152aa7e3adce0b04241ca125919898c9c0206d12a",
  "0xd650b2abb89931114d69d2ad00f599283cdf4777831744ab54146c67d4a0ac36",
  "0x2a83cfba5f1a75cfd71e179986e8f9ffdf4662416cdf666d5ca68a89afa70402",
  "0xf0fceeb37ac7f29ffaad151ed3b014e8b0defef75e809d2e89742be1e9288a31",
  "0x3e9faa00b5aefba8117248671dc2660ee041dca8fee2a9821e5244e99254e113",
  "0x20b54a0d6c61bc1bec7efd43bdef12ce2e5b6594dba0a14c1075b981c869371e",
  "0x340c9f0e675b5bdfaefe430f9e841bb546049bd74607cbd176fa0884d7c6e050",
  "0xb8930df60aaaeaa63aea3b02608bc2d421911497f8ad16a6f78f6d18d547322f",
  "0x8a89850d247c106182a9a25ea460595b987823b597b6356d42223835101b564f",
  "0xc8ae69c3d334803937e07042aea49aed8eb8b8d6bd0749e28a7e69b2cd1b1254",
  "0xa4d2d9b46c4b3b62def7a04ed1137705807cde17ce1497ddd20e1024a5d0a750",
  "0xbae2ec7be2739aee27cac82b70976efb6029bec1a00a168c6dd77b056cc1b928",
  "0x78528b9c16645bfb2f318bc822e82559ecf58eb0b61ff0a638b308b4d2681a27",
  "0xa60371fd26387ad465fbfec6421627ac3a88582ccc19303dce1e3d3e23851342",
  "0x00547672b7e364d9747dd598d6469b2390588fa67246a08cd663a7f97a04b036",
  "0x2e72c52d49b28bcc07692ec4ea447782e00b3b5afaf9a6e137ddcd88098a2f16",
  "0xfe21c181f9aa44ce5e8c3466eee31fd23698744c9b94098f6d9a383ed5d7dc31",
  "0x3aca7b7dbb5d19b1b4de64a5bac88f04491a95026c53b35960d852bce0402847",
  "0xb8c76ad8ad2cae3a561af7495c1569931c5730ba484cc0f8eecb39afb61c5915",
  "0x5a91e64453fc596e8fc4dd68ddf06e9304f319d88d536a998d852c459bbf3b13",
  "0x24a76d62e8e729b0585c64f6392a4393e21a91227bfa4febb42a879b3b9be81f",
  "0xfc4800d15685ac412efd98e8a75adf84836ce6ac1a5b4552ce042dac24d97f25",
  "0x6acdf347f63e10c89152795f1afdae966b5efd42b3273f9b174ba27dac873f1c",
  "0x44bf158f52b4876c27ed6cca6edcfbca9632e033985286199c3530cf7fc1df12",
  "0x3c18c38660d93a14566e9fbee73daf7aabb68c4c2f1f995128820dc339f2fb10",
]

export const availableWorkerListAtom = atom(get => {
  const clusterInfo = get(currentClusterAtom)
  if (clusterInfo) {
    return R.difference(clusterInfo.workers, ExcludedWorkers)
  }
  return []
})


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// PRuntime
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const DEFAULT_ENDPOINT = 'https://poc5.phala.network/tee-api-1'

export const userSelectedPruntimeAtom = atomWithStorage<Record<string, string>>('user-selected-pruntime', {})

export const pruntimeURLAtom = atom(
  get => {
    const rec = get(userSelectedPruntimeAtom)
    const endpoint = get(endpointAtom)
    if (rec[endpoint]) {
      return rec[endpoint]
    }
    const pruntimes = get(availablePruntimeListAtom)
    return R.head(pruntimes) || DEFAULT_ENDPOINT
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
  return queryEndpointList(api, workerId)
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

export const phatRegistryAtom = atom(async (get) => {
  const api = get(apiPromiseAtom)
  const clusterId = get(currentClusterIdAtom)
  const workerId = get(currentWorkerIdAtom)
  const pruntimeURL = get(pruntimeURLAtom)
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

export const pinkLoggerResultAtom = atom<PinkLoggerRecord[]>([])

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
//  Current Contract
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function unsafeFetchMetadataProgressive(deps: { registry: OnChainRegistry, localCachedContracts: Record<ContractKey, LocalContractInfo> }) {
  const { registry, localCachedContracts } = deps

  return async function _unsafeFetchedMetadataProgressive(contractId: string) {
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
    const [selfhostAbi, patronAbi] = await Promise.all([
      TE.tryCatch(() => unsafeGetAbiFromGitHubRepoByCodeHash(codeHash), R.always(null))(),
      TE.tryCatch(() => unsafeGetAbiFromPatronByCodeHash(codeHash), R.always(null))(),
    ])
    if (isRight(patronAbi)) {
      return {
        contractId: contractId,
        codeHash,
        deployer,
        found: true,
        verified: true,
        cached,
        metadata: patronAbi.right as ContractMetadata,
        source: 'Patron',
      }
    } else if (isRight(selfhostAbi)) {
      return {
        contractId: contractId,
        codeHash,
        deployer,
        found: true,
        verified: true,
        cached,
        metadata: selfhostAbi.right as ContractMetadata,
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
  const registry = get(phatRegistryAtom)
  const localCachedContracts = get(localContractsAtom)
  const contractId = get(currentContractIdAtom)
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