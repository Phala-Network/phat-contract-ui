import type { Result, U64, Bool } from '@polkadot/types'
import React, { type ReactNode, Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  FormControl,
  FormLabel,
  Step,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  Stepper,
  NumberInput,
  NumberInputField,
  ButtonGroup,
  useToast,
  IconButton,
  Heading,
  Skeleton,
  Table,
  Tbody,
  Tr as ChakraTr,
  Th as ChakraTh,
  Td as ChakraTd,
  TableContainer,
  Tag,
} from '@chakra-ui/react'
import { VscClose, VscCopy } from 'react-icons/vsc'
import { MdOpenInNew } from 'react-icons/md'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithReducer, atomWithReset, loadable } from 'jotai/utils'
import { RESET } from 'jotai/utils'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Link, useMatch } from '@tanstack/react-location'
import {
  type OnChainRegistry,
  type CertificateData,
  PinkCodePromise,
  PinkBlueprintPromise,
  unsafeGetAbiFromGitHubRepoByCodeHash,
  unsafeGetWasmFromPatronByCodeHash,
  unsafeCheckCodeHashExists,
  unsafeGetWasmFromGithubRepoByCodeHash,
  signAndSend,
} from '@phala/sdk'
import { Abi } from '@polkadot/api-contract'
import { Keyring } from '@polkadot/keyring'
import Decimal from 'decimal.js'
import * as R from 'ramda'
import { type BN } from '@polkadot/util'
import { isRight } from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'

import { useShowAccountSelectModal } from '@/components/app-ui'
import { Alert } from '@/components/ErrorAlert'
import Code from '@/components/code'
import { currentAccountAtom, currentAccountBalanceAtom, signerAtom } from '@/features/identity/atoms'
import {
  candidateAtom,
  currentClusterIdAtom,
  contractSelectedInitSelectorAtom,
  phatRegistryAtom,
  type LocalContractInfo,
  localContractsAtom,
  cachedCertAtom,
  hasCertAtom,
  useRequestSign,
  aliceCertAtom,
  pinkLoggerAtom,
  blueprintPromiseAtom,
  instantiatedContractIdAtom,
} from '../atoms'
import ContractFileUpload from './contract-upload'
import InitSelectorField, { constructorArgumentFormAtom, constructorArgumentsAtom } from './init-selector-field'
import { apiPromiseAtom, isDevChainAtom } from '@/features/parachain/atoms'
import { getFormIsInvalid } from '../argumentsFormAtom'
import { endpointAtom } from '@/atoms/endpointsAtom'
import { connectionDetailModalVisibleAtom } from '@/components/EndpointInfo'
import useReset from '../hooks/useReset'
import { useClusterBalance, currentClusterBalanceAtom } from '../hooks/useClusterBalance'


//
// Functions
//

// HexStringSize is the size of hex string, not the size of the binary size, it arong 2x of the binary size.
function estimateDepositeFee(hexStringSize: number, clusterPrice?: BN) {
  const base = clusterPrice ? clusterPrice.toNumber() : 0
  return new Decimal(base).mul(hexStringSize / 2 * 2.2).div(1e12).toNumber()
}

interface CheckInstantiateContextEnv {
  phatRegistry: OnChainRegistry
  publicCert: CertificateData
}

type InstantiateContext = {
  mode: 'upload',
  codeExists: boolean,
  codeHash?: string | null,
  phalaBuildAbi?: Record<string, unknown>,
  patronBuildAbi?: Record<string, unknown>,
} | {
  mode: 'instantiate',
  codeExists: boolean,
  phalaBuildAbi?: Record<string, unknown>,
  patronBuildAbi?: Record<string, unknown>,
  codeHash: string,
}

function getInstantiateContext({ phatRegistry, publicCert }: CheckInstantiateContextEnv) {
  const  systemContract = phatRegistry.systemContract
  if (!systemContract) {
    throw new Error('System contract is not ready.')
  }
  // @TODO endpoint & cluster can be override. 
  return async function unsafeCheckInstantiateContext(codeHash?: string | null): Promise<InstantiateContext> {
    if (!codeHash) {
      return {
        mode: 'upload',
        codeExists: false,
        codeHash,
      }
    }
    const _unsafeCheckCodeHashExists = unsafeCheckCodeHashExists({ systemContract, cert: publicCert })
    const [codeExistsQuery, phalaBuildAbiQuery] = await Promise.all([
      TE.tryCatch(() => _unsafeCheckCodeHashExists(codeHash), R.always(null))(),
      TE.tryCatch(() => unsafeGetAbiFromGitHubRepoByCodeHash(codeHash), R.always(null))(),
    ])
    const codeExists = isRight(codeExistsQuery) && codeExistsQuery.right
    const phalaBuildAbi = isRight(phalaBuildAbiQuery) ? phalaBuildAbiQuery.right : undefined
    const patronBuildAbi = undefined
    return {
      mode: codeExists ? 'instantiate' : 'upload',
      codeExists,
      phalaBuildAbi,
      patronBuildAbi,
      codeHash,
    }
  }
}

//
// Atoms
//

const presetCodeHashAtom = atomWithReducer<null | string, null | string>(null, (_, codeHash: string | null) => {
  if (codeHash && codeHash.substring(0, 2) === '0x') {
    return codeHash.substring(2)
  }
  return codeHash
})

const instantiateContextAtom = atom(async (get) => {
  const phatRegistry = get(phatRegistryAtom)
  const publicCert = get(aliceCertAtom)
  const unsafeGetInstantiateContext = getInstantiateContext({ phatRegistry, publicCert })
  return await unsafeGetInstantiateContext(get(presetCodeHashAtom))
})

const uploadPlanAtom = atom((get) => {
  const instantiateContext = get(instantiateContextAtom)
  const candidate = get(candidateAtom)
  let canFetch = false
  let fetchSource: string | undefined = undefined
  if (instantiateContext.phalaBuildAbi) {
    fetchSource = 'phala'
    canFetch = true
  } else if (instantiateContext.patronBuildAbi) {
    fetchSource = 'patron'
    canFetch = true
  }
  return {
    needFetch: !instantiateContext.codeExists,
    metadataMissed: !candidate,
    canFetch,
    fetchSource,
  }
})

const wasmAtom = atomWithReset<Uint8Array | null>(null) 

const wasmFetchStateAtom = atomWithReset<{
  isFetching: boolean,
  fetched: boolean,
  minDepositFee: number,
  error: string | null,
  attempts: number,
}>({
  isFetching: false,
  fetched: false,
  minDepositFee: 0,
  error: null,
  attempts: 0,
})

// Write-only atom
const wasmFetchAtom = atom(null, async (get, set) => {
  const { codeHash, phalaBuildAbi, patronBuildAbi } = get(instantiateContextAtom)
  const state = get(wasmFetchStateAtom)
  const registry = get(phatRegistryAtom)
  const currentBalance = get(currentClusterBalanceAtom)

  if (!codeHash) {
    console.warn('Unexpected path: codeHash is not available form wasmFetchOnlyAtom')
    return
  }

  set(wasmFetchStateAtom, { ...state, isFetching: true })

  let error = null, result = null, attempts = state.attempts, minDepositFee = 0
  try {
    if (phalaBuildAbi) {
      result = await unsafeGetWasmFromGithubRepoByCodeHash(codeHash)
    } else if (patronBuildAbi) {
      result = await unsafeGetWasmFromPatronByCodeHash(codeHash)
    }
  } catch (err) {
    error = `Fetch wasm failed: ${(err as Error).message}`
  }
  set(wasmFetchStateAtom, { isFetching: false, error, attempts: attempts + 1, fetched: false, minDepositFee })
  if (result) {
    // result is Uint8Array here, so we need to multiply it by 2 as hex string size.
    minDepositFee = estimateDepositeFee(result.length * 2, registry.clusterInfo?.depositPerByte)
    if (currentBalance < minDepositFee) {
      set(wasmFetchStateAtom, { isFetching: false, error: `Insufficient balance: ${minDepositFee.toFixed(10)} PHA required`, attempts: attempts + 1, fetched: true, minDepositFee })
    } else {
      set(wasmFetchStateAtom, { isFetching: false, error, attempts: attempts + 1, fetched: true, minDepositFee })
    }
    set(wasmAtom, result)
  }
})


const wasmUploadStateAtom = atomWithReset<{
  isProcessing: boolean,
  processed: boolean,
  error: string | null,
  attempts: number,
}>({
  isProcessing: false,
  processed: false,
  error: null,
  attempts: 0,
})

const wasmCanUploadAtom = atom(get => {
  const candidate = get(candidateAtom)
  const hasCert = get(hasCertAtom)
  const wasm = get(wasmAtom)
  if (hasCert && candidate && (candidate.source.wasm || wasm)) {
    return true
  }
  return false
})

// Write-only atom
const wasmUploadAtom = atom(null, async (get, set) => {
  const registry = get(phatRegistryAtom)
  const currentAccount = get(currentAccountAtom)
  const signer = get(signerAtom)
  const candidate = get(candidateAtom)
  const [, cert] = get(cachedCertAtom)
  const wasm = get(wasmAtom)
  const logger = get(pinkLoggerAtom)

  if (!candidate || !cert || !(candidate?.source.wasm || wasm) || !currentAccount || !signer) {
    throw new Error('Unexpected path: wasmUploadAtom is called but candidate or cert is not available.')
  }

  set(wasmUploadStateAtom, prev => ({ isProcessing: true, processed: false, error: null, attempts: prev.attempts + 1 }))

  let blockNumber: Nullable<number>
  try {
    const code = wasm || candidate.source.wasm
    const codePromise = new PinkCodePromise(registry.api, registry, candidate, code)
    const uploadResult = await signAndSend(codePromise.upload(), currentAccount.address, signer)
    await uploadResult.waitFinalized(registry.alice, await registry.getAnonymousCert(), 12_000) // 1 mins
    set(blueprintPromiseAtom, uploadResult.blueprint)
    set(wasmUploadStateAtom, prev => ({ isProcessing: false, processed: true, error: null, attempts: prev.attempts + 1 }))
  } catch (err) {
    let error = `${err}`
    let isTimeout =  error.indexOf('Timeout') !== -1
    if (logger && isTimeout) {
      // @FIXME for now we don't have real 'tail' functional that get latest log records, so we need iter all.
      const contractId = registry.systemContract?.address?.toHex()
      if (contractId) {
        const { records } = await logger.tail(1000, { contract: contractId, block_number: blockNumber! })
        // @ts-ignore
        const found: Nullable<Record<string, string>> = R.find(rec => rec.blockNumber === blockNumber, records)
        if (found) {
          error = found.message
        }
      }
    }
    set(wasmUploadStateAtom, prev => ({ isProcessing: false, processed: false, error, attempts: prev.attempts + 1 }))
  }
})

// Write-only atom
const restoreBlueprintAtom = atom(null, (get, set) => {
  const registry = get(phatRegistryAtom)
  const presetCodeHash = get(presetCodeHashAtom)
  const candidate = get(candidateAtom)
  const codeHash = presetCodeHash ? `0x${presetCodeHash}` : candidate?.source.hash
  if (candidate && codeHash) {
    set(blueprintPromiseAtom, new PinkBlueprintPromise(registry.api, registry, candidate, codeHash))
  }
})

// Write-only atom
const setCustomMetadataAtom = atom(null, (_get, set, files: FileList | null) => {
  if (!files || files.length === 0) {
    return
  }
  const reader = new FileReader()
  reader.addEventListener('load', () => {
    try {
      const contract = JSON.parse(reader.result as string)
      if (!contract || !contract.source || !contract.source.hash) {
        return
      }
      new Abi(contract)
      set(candidateAtom, contract)
    } catch (e) {
      console.error(e)
    }
  })
  reader.readAsText(files[0], 'utf-8')
})

const selectedContructorAtom = atom((get) => {
  const contract = get(candidateAtom)
  const abi = get(currentAbiAtom)
  const chooseInitSelector = get(contractSelectedInitSelectorAtom)
  if (!contract) {
    return null
  }
  const spec = contract.V3 ? contract.V3.spec : contract.spec
  if (spec.constructors.length === 0) {
    throw new Error('No constructor found.')
  }
  const defaultInitSelector = R.pipe(
    R.filter((c: ContractMetaConstructor) => c.label === 'default' || c.label === 'new'),
    R.sortBy((c: ContractMetaConstructor) => c.args.length),
    i => R.head<ContractMetaConstructor>(i),
    (i) => i ? i.selector : undefined,
  )(spec.constructors)
  const initSelector = chooseInitSelector || defaultInitSelector || R.head(spec.constructors)?.selector
  if (!initSelector) {
    throw new Error('No valid initSelector specified.')
  }
  const label = R.prop('label', R.find(i => i.selector === initSelector, spec.constructors))
  const method = abi?.constructors.find(i => i.identifier === label) || null
  if (method) {
    return method.method
  }
  throw new Error(`Can't find the method label as '${label}'.`)
})

const currentAbiAtom = atom(get => {
  const candidate = get(candidateAtom)
  if (!candidate) {
    return null
  }
  const abi = new Abi(candidate)
  return abi
})

const currentStepAtom = atom(get => {
  const hasCert = get(hasCertAtom)
  const blueprint = get(blueprintPromiseAtom)
  const instantiatedContractId = get(instantiatedContractIdAtom)
  //
  // Step 1: user sign the certificate and check the current balance in cluster 
  //
  if (!hasCert) {
    return 0
  }
  //
  // Step 2: check blueprint promise exists or not, which means user already upload to cluster.
  //
  if (!blueprint) {
    return 1
  }
  //
  // Step 3: check if the contract instantiated or not.
  //
  if (!instantiatedContractId) {
    return 2
  }
  //
  // For not the whole progress should has been finished.
  //
  return 3
})

const uploadCodeCheckAtom = atom(async get => {
  const registry = get(phatRegistryAtom)
  const candidate = get(candidateAtom)
  const currentBalance = get(currentClusterBalanceAtom)
  const systemContract = registry.systemContract
  const account = get(currentAccountAtom)
  const [, cert] = get(cachedCertAtom)
  const wasm = get(wasmAtom) || candidate?.source.wasm || ''
  if (!candidate || !candidate.source || (!wasm && !candidate.source.hash) || !registry.clusterInfo || !systemContract || !account || !cert) {
    return { canUpload: false, showTransferToCluster: false, exists: false }
  }
  const { output } = await systemContract.query['system::codeExists']<Bool>(account.address, { cert }, candidate.source.hash, 'Ink')
  if (output && output.isOk && output.asOk.isTrue) {
    return { canUpload: false, showTransferToCluster: false, exists: true, codeHash: candidate.source.hash }
  }
  const storageDepositeFee = estimateDepositeFee(wasm.length, registry.clusterInfo.depositPerByte)
  if (currentBalance < storageDepositeFee) {
    return { canUpload: false, showTransferToCluster: true, storageDepositeFee, exists: false }
  }
  return { canUpload: true, showTransferToCluster: false, exists: false }
})

//
// hooks
//

/**
  * This hook is used for set the contract metadata from preset code hash (the code hash from URL).
  */
function useSetContractMetadataFromPresetCodeHash() {
  const instantiateContext = useAtomValue(loadable(instantiateContextAtom))
  const setContractMetadata = useSetAtom(candidateAtom)
  useEffect(() => {
    if (instantiateContext.state === 'hasData') {
      const { patronBuildAbi, phalaBuildAbi } = instantiateContext.data
      if (patronBuildAbi) {
        setContractMetadata(patronBuildAbi as ContractMetadata)
      } else if (phalaBuildAbi) {
        setContractMetadata(phalaBuildAbi as ContractMetadata)
      }
    }
  }, [instantiateContext, setContractMetadata])
}

function useSetRouterContext() {
  let { params: { codeHash } } = useMatch()
  const setPresetCodeHash = useSetAtom(presetCodeHashAtom)
  const reset = useReset()

  useEffect(() => {
    reset()
    setPresetCodeHash(codeHash)
  }, [setPresetCodeHash, codeHash, reset])

  useSetContractMetadataFromPresetCodeHash()
}

function useUploadCode() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{message: string, level: 'info' | 'error'} | null>(null)
  const { requestSign } = useRequestSign()

  const [, cert] = useAtomValue(cachedCertAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const contract = useAtomValue(candidateAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)
  const setBlueprintPromise = useSetAtom(blueprintPromiseAtom)

  const showAccountSelectModal = useShowAccountSelectModal()

  const upload = useCallback(async () => {
    setError(null)
    if (!contract || !currentAccount || !signer) {
      setError({ message: 'Plase choose the contract file to continue.', level: 'info' })
      return
    }
    setIsLoading(true)
    try {
      let _cert = cert
      if (!_cert) {
        _cert = await requestSign()
      }
      if (!_cert) {
        setError({ message: 'You need sign the certificate to continue.', level: 'info' })
        // TODO show toast.
        return
      }
      const codePromise = new PinkCodePromise(registry.api, registry, contract, contract.source.wasm)
      const result = await signAndSend(codePromise.upload(), currentAccount.address, signer)
      await result.waitFinalized(registry.alice, await registry.getAnonymousCert(), 120_000)
      setBlueprintPromise(result.blueprint)
    } catch (err) {
      // TODO: better error handling?
      if ((err as Error).message.indexOf('You need connected to an endpoint & pick a account first.') > -1) {
        showAccountSelectModal()
      } else if ((err as Error).message.indexOf('Cancelled') === -1) {
        console.error(err)
        setError({ message: `Contract upload failed: ${err}`, level: 'error' })
      } else {
        console.error(err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [registry, contract, currentAccount, cert, setBlueprintPromise, showAccountSelectModal])

  const restoreBlueprint = useCallback((codeHash: string) => {
    if (!contract) {
      return
    }
    setBlueprintPromise(new PinkBlueprintPromise(registry.api, registry, contract, codeHash))
  }, [registry, contract])

  const resetError = useCallback(() => setError(null), [setError])
  const hasError = useMemo(() => error !== null, [error])

  return { isLoading, upload, resetError, hasError, error, restoreBlueprint }
}

//
// UI Components
//

function StepSection({ children, index, isEnd }: { children: ReactNode, index: number, isEnd?: boolean }) {
  const currentStep = useAtomValue(currentStepAtom)
  if (currentStep < index) {
    return null
  }
  return (
    <Step tw="w-full">
      <StepIndicator tw="mt-0.5">
        <StepStatus
          complete={<StepIcon />}
          incomplete={<StepNumber />}
          active={<StepNumber />}
        />
      </StepIndicator>
      <div css={[
        tw`flex-grow ml-4 mb-8 px-8 py-4 rounded-sm bg-gray-700 transition-all`,
        (index === currentStep) ? tw`opacity-100` : tw`opacity-75 hover:opacity-100`,
        tw`flex flex-col gap-4`
      ]}>
        {children}
      </div>
      {!isEnd ? (
        <StepSeparator />
      ) : null}
    </Step>
  )
}

const Tr = tw(ChakraTr)`min-h-[4rem]`
const Th = tw(ChakraTh)`max-w-[20rem]`
const Td = tw(ChakraTd)`py-4`

//
// Section 1: Instantiate Candidate Info
//

function InstantiateHint() {
  const instantiateContext = useAtomValue(instantiateContextAtom)
  const { hasCert, requestSign, isWaiting } = useRequestSign()
  const showAccountSelectModal = useShowAccountSelectModal()

  const handleSign = async () => {
    try {
      await requestSign()
    } catch (err) {
      if ((err as Error).message.indexOf('You need connected to an endpoint & pick a account first.') > -1) {
        showAccountSelectModal()
      } else {
        console.error(err)
      }
    }
  }

  if (!instantiateContext.codeHash && hasCert) {
    return null
  }
  return (
    <Alert title="Notice">
      <div tw="flex flex-col gap-1.5 text-gray-300">
        {instantiateContext.codeHash ? (
          <>
            {instantiateContext.mode === 'upload' ? (
              <p>You are trying instantiate a contract from a hash, and it can't found in the cluster. You might better upload and deploy one.</p>
            ) : null}
            {instantiateContext.patronBuildAbi ? (
              <p tw="flex flex-row items-center">
                This contract is verified by
                <a href="https://patron.works" target="_blank" tw="underline mx-1">
                  <img src="https://patron.works/patron-favicon.svg" alt="Patron" tw="h-4 w-4 inline ml-[2px] mr-[1px]" />
                  <span>Patron</span>
                </a>
                . You can checkout the verification
                <a href={`https://patron.works/codeHash/${instantiateContext.codeHash}`} target="_blank" tw="underline mx-1">here</a>.
              </p>
            ) : instantiateContext.phalaBuildAbi ? (
              <p tw="flex flex-row items-center">
                This contract is provided by Phala Team. You can find more details
                <a href="https://phala-network.github.io/phat-contract-artifacts/" target="_blank" tw="underline mx-1">here</a>.
              </p>
            ) : instantiateContext.mode === 'instantiate'? (
              <p tw="flex flex-row items-center">
                This contract is not verified and may contain potential risks. Please specify the custom metadata file to proceed.
              </p>
            ) : null}
          </>
        ) : null}
        {!hasCert ? (
          <p>
            You need sign the cert to continue.
          </p>
        ) : null}
        {!hasCert ? (
          <div tw="mt-2">
            <Button
              minW="8rem"
              size="sm"
              colorScheme="phalaDark"
              isLoading={isWaiting}
              onClick={handleSign}
            >
              Sign
            </Button>
          </div>
        ) : null}
      </div>
    </Alert>
  )
}

function InstantiateInfoEndpoint() {
  const endpoint = useAtomValue(endpointAtom)
  const cluster = useAtomValue(currentClusterIdAtom)
  const setConnectionDetailModalVisible = useSetAtom(connectionDetailModalVisibleAtom)
  return (
    <Tr>
      <Th>Endpoint & Cluster</Th>
      <Td>
        <div tw="flex flex-row gap-2 min-h-[2rem]">
          <div tw="flex flex-row items-center gap-2">
            <Code>{endpoint}</Code>
            <Code>{cluster.substring(0, 4)}...{cluster.substring(cluster.length - 4)}</Code>
            <Button size="xs" onClick={() => setConnectionDetailModalVisible(true)}>Switch</Button>
          </div>
        </div>
      </Td>
    </Tr>
  )
}

function InstantiateInfoClusterBalance() {
  const { hasCert, requestSign, isWaiting } = useRequestSign()
  const { currentBalance } = useClusterBalance()
  const [showInlineTransferForm, setShowInlineTransferForm] = useState(false)
  return (
    <Tr>
      <Th>Cluster Balance</Th>
      <Td>
        <div tw="flex flex-row gap-2 items-center min-h-[2rem]">
          {hasCert ? (
            <>
              <span tw="text-white whitespace-nowrap" title={currentBalance.toString()}>{currentBalance.toFixed(12)} PHA</span>
              {showInlineTransferForm ? (
                <div tw="flex flex-row items-center gap-1">
                  <TransferToCluster />
                  <Button mt="0.5" size="xs" onClick={() => setShowInlineTransferForm(false)}><VscClose /></Button>
                </div>
              ) : (
                <Button size="xs" onClick={() => setShowInlineTransferForm(true)}>Transfer</Button>
              )}
            </>
          ) : (
            <Button size="xs" isLoading={isWaiting} onClick={requestSign}>Check my cluster balance</Button> 
          )}
        </div>
      </Td>
    </Tr>
  )
}

function InstantiateInfoCandidateHint() {
  const instantiateContext = useAtomValue(instantiateContextAtom)
  const toast = useToast()
  const candidate = useAtomValue(candidateAtom)
  const codeHash = instantiateContext.codeHash ? `0x${instantiateContext.codeHash}` : candidate?.source.hash
  if (!codeHash || !candidate) {
    return null
  }
  return (
    <>
      <Tr>
        <Th>Hash</Th>
        <Td>
          <div tw="flex flex-row gap-2 min-h-[2rem]">
            {codeHash ? (
              <>
                <div tw="flex flex-row items-center">
                  <Code>{codeHash}</Code>
                </div>
                <CopyToClipboard
                  text={codeHash}
                  onCopy={() => toast({title: 'Copied!'})}
                >
                  <IconButton aria-label="copy" size="sm"><VscCopy /></IconButton>
                </CopyToClipboard>
              </>
            ) : null}
          </div>
        </Td>
      </Tr>
      <Tr>
        <Th>Name</Th>
        <Td>
          <div tw="flex flex-row items-center gap-1 min-h-[2rem]">
            {candidate && candidate.contract ? (
              <>
                <span>{candidate.contract.name}</span><code>{candidate.contract.version}</code>
              </>
            ) : null}
          </div>
        </Td>
      </Tr>
      {instantiateContext.codeExists ? (
      <Tr>
        <Th>Verification</Th>
        <Td>
          <div tw="min-h-[2rem] flex flex-row items-center">
            {instantiateContext.patronBuildAbi ? (
              <Tag size="sm" colorScheme="green">
                <a
                  href={`https://patron.works/codeHash/${instantiateContext.codeHash}`}
                  target="_blank"
                >
                  Verified by Patron
                </a>
                <MdOpenInNew tw="ml-1" />
              </Tag>
            ) : null}
            {instantiateContext.phalaBuildAbi ? (
              <Tag size="sm" colorScheme="green">
                Provided by Phala
              </Tag>
            ) : null}
            {!instantiateContext.phalaBuildAbi && !instantiateContext.patronBuildAbi ? (
              <Tag size="sm" colorScheme="yellow">
                Unverified
              </Tag>
            ) : null}
          </div>
        </Td>
      </Tr>
      ) : null}
    </>
  )
}
  
//
// Section 2: Choose a file or fetch wasm file from remote. 
//

function GetPhaButton() {
  const api = useAtomValue(apiPromiseAtom)
  const endpoint = useAtomValue(endpointAtom)
  const isDevChain = useAtomValue(isDevChainAtom)
  const account = useAtomValue(currentAccountAtom)
  const [loading, setLoading] = useState(false)
  if (!account) {
    return null
  }
  if (!isDevChain) {
    <Button as="a" size="sm" href="https://docs.phala.network/introduction/basic-guidance/get-pha-and-transfer" target="_blank" rel="noopener">
      Get PHA
    </Button>
  }

  async function getTestCoin () {
    setLoading(true)
    const keyring = new Keyring({ type: 'sr25519' })
    let suri = '//Alice'
    if (endpoint.startsWith('wss://poc6.phala.network')) {
      suri = 'purchase issue dinner sock coin brown buddy vehicle clock insect traffic sting'
    }
    const pair = keyring.addFromUri(suri)
    await api.tx.balances.transferKeepAlive(account?.address, '1000000000000000')
      .signAndSend(pair, { nonce: -1 })
    setLoading(false)
  }
  return (
    <Button
      size="sm"
      isLoading={loading}
      onClick={getTestCoin}
    >
      Get Test-PHA
    </Button>
  )
}

function TransferToClusterAlert({ storageDepositeFee }: { storageDepositeFee: number }) {
  const currentAccountBalance = useAtomValue(currentAccountBalanceAtom)
  const { currentBalance, transfer, isLoading } = useClusterBalance()
  const [showCustomTransferToClusterForm, setShowInlineTransferForm] = useState(false)
  return (
    <Alert status="info" title="Cluster Account Balance is too low">
      <p>You need at least <span tw="text-phala">{storageDepositeFee.toFixed(12)}</span> PHA in your cluster account balance to pay the storage deposit fee.</p>
      {currentAccountBalance.toNumber() < storageDepositeFee ? (
        <>
          <div tw="flex flex-row gap-2">
            <GetPhaButton />
          </div>
        </>
      ) : (
        <>
          {showCustomTransferToClusterForm ? (
            <div tw="flex flex-col gap-2">
              <p><strong>Current Cluster Account Balance: </strong><span tw="font-semibold">{currentBalance}</span> PHA</p>
              <TransferToCluster />
            </div>
          ) : (
          <div tw="flex flex-row gap-2 mt-2.5">
            <Button isLoading={isLoading} size="sm" onClick={() => transfer(new Decimal(Math.max(0.05, storageDepositeFee)))}>
              Transfer storage deposit fee
            </Button>
            <Button size="sm" onClick={() => setShowInlineTransferForm(true)}>
              Custom
            </Button>
          </div>
          )}
        </>
      )}
    </Alert>
  )
}

function UploadCodeButton() {
  const hasCert = useAtomValue(hasCertAtom)
  const { isLoading, upload, error, hasError, restoreBlueprint } = useUploadCode()
  const { canUpload, showTransferToCluster, storageDepositeFee, exists, codeHash } = useAtomValue(uploadCodeCheckAtom)
  const activeStep = useAtomValue(currentStepAtom)
  return (
    <div tw="ml-4 mt-2.5">
      {hasError ? (
        <div tw="mb-2">
          <Alert status={error?.level || 'info'} title={error?.message || 'Unknown Error'}>
          </Alert>
        </div>
      ) : null}
      {showTransferToCluster && storageDepositeFee ? (
        <div tw="mb-2">
          <TransferToClusterAlert storageDepositeFee={storageDepositeFee} />
        </div>
      ) : null}
      {exists && codeHash && activeStep < 2 ? (
        <div tw="mb-2 pr-5">
          <Alert status="info" title="Code Hash Already Exists">
            <p>You don't need upload and pay the deposite fee again.</p>
          </Alert>
        </div>
      ) : null}
      {activeStep < 2 ? (
        <div>
          {exists && codeHash ? (
            <Button onClick={() => restoreBlueprint(codeHash)}>
              Restore
            </Button>
          ) : (
            <Button isDisabled={!canUpload} isLoading={isLoading} onClick={upload}>
              {!hasCert ? 'Sign Cert and Upload' : 'Upload'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CodeUploadForm() {
  const uploadPlan = useAtomValue(uploadPlanAtom)

  const restore = useSetAtom(restoreBlueprintAtom)
  const setCustomMetadata = useSetAtom(setCustomMetadataAtom)

  const fetchState = useAtomValue(wasmFetchStateAtom)
  const fetch = useSetAtom(wasmFetchAtom)

  const canUpload = useAtomValue(wasmCanUploadAtom)
  const uploadState = useAtomValue(wasmUploadStateAtom)
  const upload = useSetAtom(wasmUploadAtom)

  const activeStep = useAtomValue(currentStepAtom)

  const candidate = useAtomValue(candidateAtom)
  const presetCodeHash = useAtomValue(presetCodeHashAtom)

  const { currentBalance, transfer, isLoading } = useClusterBalance()
  const currentAccountBalance = useAtomValue(currentAccountBalanceAtom)

  if (!currentAccountBalance.gt(0) && currentBalance === 0) {
    return (
      <div tw="flex flex-col gap-2.5">
        <Alert status="warning" title="Funds required">
          <p>Your account balances are too low to continue.</p>
          <div tw="flex flex-row mt-2.5">
            <GetPhaButton />
          </div>
        </Alert>
      </div>
    )
  }

  if (!uploadPlan.needFetch) {
    return (
      <div tw="flex flex-col gap-2.5">
        <div>
          <p>
            You don't need upload and pay the deposite fee again, the code already exists in current cluster.
            {uploadPlan.metadataMissed ? (
              <span tw="ml-0.5">But we can't found the metadata from verified source, so please pick one manually.</span>
            ) : null}
          </p>
        </div>
        <FormControl>
          <FormLabel>Custom Metadata</FormLabel>
          <input type="file" name="custom-abi" onChange={(ev) => setCustomMetadata(ev.target.files)} />
        </FormControl>
        {
          candidate && candidate.source.hash !== `0x${presetCodeHash}` ? (
            <Alert status="warning" title="Codehash not match">
              <p>The codehash of the selected Metadata file does not match the current contract, please confirm before proceeding to the next step.</p>
            </Alert>
          ) : null
        }
        <div tw="mt-4">
          <Button isDisabled={uploadPlan.metadataMissed} onClick={restore} colorScheme={activeStep === 1 ? "phalaDark" : undefined}>
            Restore
          </Button>
        </div>
      </div>
    )
  }

  if (uploadPlan.canFetch) {
    return (
      <div tw="flex flex-col gap-2.5">
        {uploadState.error ? (
          <Alert status="error" title="Upload Failed">
            <p>{uploadState.error}</p>
          </Alert>
        ) : (fetchState.fetched && fetchState.minDepositFee > currentBalance && activeStep === 1) ? (
          <Alert status="warning" title="Your cluster balance is too low ">
            <p>You need deposit at least {fetchState.minDepositFee.toFixed(10)} PHA to your cluster account before continue.</p>
            <div tw="mt-2.5">
              <Button size="sm" isLoading={isLoading} onClick={() => transfer(new Decimal(fetchState.minDepositFee))}>Transfer minimal requirement</Button>
            </div>
          </Alert>
        ) : activeStep === 1 ? (
          <Alert status="success" title="Found matched code from verified source.">
            <p>Click the button below to fetch the code from verified source.</p>
          </Alert>
        ) : null}
        <div tw="mt-2.5 flex flex-row gap-2">
          <Button
            isDisabled={fetchState.isFetching || canUpload}
            isLoading={fetchState.isFetching}
            onClick={fetch}
            size="sm"
            colorScheme={(activeStep === 1 && !canUpload) ? "phalaDark" : undefined}
            minW="8rem"
          >
            Fetch
          </Button>
          <Button
            isDisabled={!canUpload || fetchState.minDepositFee > currentBalance}
            isLoading={uploadState.isProcessing}
            onClick={upload}
            size="sm"
            colorScheme={(activeStep === 1 && canUpload && !fetchState.error) ? "phalaDark" : undefined}
            minW="8rem"
          >
            Upload
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div tw="flex flex-col gap-2">
      <ContractFileUpload isCheckWASM={true} />
      <Suspense>
        <UploadCodeButton />
      </Suspense>
    </div>
  )
}

//
// Step 3: Blueprint Promise - instantiate contract.
//

function ContractId() {
  const blueprintPromise = useAtomValue(blueprintPromiseAtom)
  const toast = useToast()
  if (!blueprintPromise) {
    return null
  }
  const codeHash = blueprintPromise.codeHash.toHex()
  return (
    <FormControl>
      <FormLabel>
        Code Hash
      </FormLabel>
      <div tw="flex flex-row gap-2 items-center">
        <code tw="font-mono text-xs p-1 bg-black rounded">{codeHash}</code>
        <CopyToClipboard
          text={codeHash}
          onCopy={() => toast({
            title: 'Copied',
            status: 'success',
            duration: 2000,
            isClosable: true,
          })}
        >
          <IconButton aria-label='Copy' size="sm">
            <VscCopy tw="h-4 w-4" />
          </IconButton>
        </CopyToClipboard>
      </div>
    </FormControl>
  )
}

const TransferToCluster = () => {
  const hasCert = useAtomValue(hasCertAtom)
  const { isLoading, transfer, refreshBalance } = useClusterBalance()
  const [value, setValue] = useState(new Decimal(0))
  if (!hasCert) {
    return null
  }
  return (
    <div tw="flex flex-row gap-2 items-center">
      <NumberInput
        size="xs"
        onChange={(num) => setValue(new Decimal(num))}
      >
        <NumberInputField />
      </NumberInput>
      <Button
        isDisabled={isLoading}
        colorScheme="phalaDark"
        size="xs"
        onClick={() => transfer(value)}
      >
        Transfer
      </Button> 
      {isLoading ? (<Spinner colorScheme="pbalaDark" size="sm" />) : null } 
      <Button
        mt="0.5"
        size="xs"
        onClick={refreshBalance}
      >
        Refresh
      </Button>
    </div>
  )
}

const argumentsFormIsValidAtom = atom(get => {
  const form = get(get(constructorArgumentFormAtom))
  return !getFormIsInvalid(form)
})

function InstantiateGasElimiation() {
  const blueprint = useAtomValue(blueprintPromiseAtom)
  const constructor = useAtomValue(selectedContructorAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const [, cert] = useAtomValue(cachedCertAtom)
  const signer = useAtomValue(signerAtom)
  const registry = useAtomValue(phatRegistryAtom)

  const [txOptions, setTxOptions] = useState<any>(null)
  const [minClusterBalance, setMinClusterBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const { currentBalance, refreshBalance, transfer, isLoading: isUpdatingClusterBalance } = useClusterBalance()
  const userBalance = useAtomValue(currentAccountBalanceAtom)
  const args = useAtomValue(constructorArgumentsAtom)

  const [inlineChargeVisible, setInlineChargeVisible] = useState(false)
  const isValid = useAtomValue(argumentsFormIsValidAtom) 

  useEffect(() => {
    if (blueprint && constructor && currentAccount && cert && registry) {
      (async () => {
        setIsLoading(true)
        try {
          setTxOptions(null)
          // @ts-ignore
          const { gasRequired, storageDeposit, salt } = await blueprint.query[constructor](currentAccount.address, { cert }, ...args) // Support instantiate arguments.
          const gasLimit = new Decimal(gasRequired.refTime.toNumber()).mul(new Decimal(registry.clusterInfo?.gasPrice?.toNumber() || 1)).div(1e12)
          setTxOptions({
            gasLimit: gasRequired.refTime,
            storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null,
            salt
          })
          setMinClusterBalance(gasLimit.toNumber() * 1.2)
          await refreshBalance()
        } finally {
          setIsLoading(false)
        }
      })();
    }
  }, [blueprint, constructor, currentAccount, cert, registry, refreshBalance, setTxOptions, setMinClusterBalance, setIsLoading, args])

  const contract = useAtomValue(candidateAtom)
  const saveContract = useSetAtom(localContractsAtom)
  const setInstantiatedContractId = useSetAtom(instantiatedContractIdAtom)

  const instantiate = async () => {
    if (!blueprint || !currentAccount || !constructor || !txOptions || !signer) {
      return
    }
    setIsLoading(true)
    try {
      const instantiateResult = await signAndSend(
        blueprint.tx[constructor](txOptions, ...args),
        currentAccount.address,
        signer
      )
      await instantiateResult.waitFinalized()

      const { contractId } = instantiateResult
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} as LocalContractInfo }))
      setInstantiatedContractId(contractId)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div tw="mt-2 flex flex-col gap-2">
      <table tw="inline-flex">
        <tbody>
          <tr>
            <td tw="pr-2.5 text-right">Minimal Required:</td>
            <td>{isUpdatingClusterBalance ? <Spinner /> : <span tw="text-sm whitespace-nowrap" title={minClusterBalance.toString()}>{minClusterBalance.toFixed(12)} PHA</span>}</td>
          </tr>
          <tr>
            <td tw="pr-2.5 text-right">Cluster Balance:</td>
            <td>
              <span tw="text-sm whitespace-nowrap" title={currentBalance.toString()}>{currentBalance.toFixed(12)} PHA</span>
            </td>
            <td>
              <div tw="ml-2.5 flex flex-row gap-2 items-center">
                {inlineChargeVisible ? (
                  <>
                    <TransferToCluster />
                    <Button size="xs" onClick={() => setInlineChargeVisible(false)}><VscClose /></Button>
                  </>
                ) : (
                  <Button size="xs" onClick={() => setInlineChargeVisible(true)}>Transfer</Button>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div tw="mt-2 flex flex-col gap-2.5">
        {userBalance.toNumber() === 0 ? (
          <Alert status="info" title="You need funds to instantiate your contract">
            <p>Please transfer some PHA to your account first.</p>
            <div tw="mt-2.5">
              <GetPhaButton />
            </div>
          </Alert>
        ) : null}
        <div>
          {(currentBalance < minClusterBalance) ? (
            <Button
              isDisabled={!blueprint || !isValid || userBalance.toNumber() === 0}
              isLoading={isLoading}
              onClick={async () => {
                await transfer(new Decimal(minClusterBalance - currentBalance))
                await instantiate()
              }}
            >
              Transfer minimal and instantiate
            </Button>
          ) : (
            <Button isDisabled={!blueprint || !isValid} isLoading={isLoading} onClick={instantiate}>Instantiate</Button>
          )}
        </div>
      </div>
    </div>
  )
}

//
// Step 4
//

function InstantiatedFinish() {
  const instantiatedContractId = useAtomValue(instantiatedContractIdAtom)
  const reset = useReset()
  const toast = useToast()
  if (!instantiatedContractId) {
    return null
  }
  return (
    <div tw="flex flex-col gap-4">
      <Alert status='success' title="Contract Instantiate Successfully">
        <div tw="mb-4 flex flex-col gap-2">
          <p>Contract Uploaded and instantiated successfully. You need staking computation resource to run the contract.</p>
          <div tw="flex flex-row gap-2 items-center">
            <span>Contract ID: </span>
            <code tw="font-mono text-xs p-1 bg-black rounded">{instantiatedContractId}</code>
            <CopyToClipboard
              text={instantiatedContractId}
              onCopy={() => toast({
                title: 'Copied',
                status: 'success',
                duration: 2000,
                isClosable: true,
              })}
            >
              <IconButton aria-label='Copy' size="sm">
                <VscCopy tw="h-4 w-4" />
              </IconButton>
            </CopyToClipboard>
          </div>
        </div>
        <ButtonGroup>
          <Link to={`/contracts/view/${instantiatedContractId}`}>
            <Button
              colorScheme="phalaDark"
              onClick={() => reset()}
            >
              Go next
            </Button>
          </Link>
        </ButtonGroup>
      </Alert>
    </div>
  )
}

//
// Final Page Composition
//

export default function FatContractUploadForm() {
  useSetRouterContext()

  const activeStep = useAtomValue(currentStepAtom)
  return (
    <div tw="w-full flex flex-col gap-4">
      <Heading tw="flex flex-row items-center gap-4">
        <span>Deploy Contract</span>
      </Heading>
      <Stepper index={activeStep} size='sm' gap='0' orientation='vertical' colorScheme="phalaDark">
        <StepSection index={0}>
          <Suspense>
            <InstantiateHint />
          </Suspense>
          <TableContainer>
            <Table size="sm" colorScheme="phalaDark">
              <Tbody>
                <InstantiateInfoEndpoint />
                <Suspense>
                  <InstantiateInfoClusterBalance />
                </Suspense>
                <Suspense fallback={<Tr><Td colSpan={2}><Skeleton height="2rem" /></Td></Tr>}>
                  <InstantiateInfoCandidateHint />
                </Suspense>
              </Tbody>
            </Table>
          </TableContainer>
        </StepSection>
        <StepSection index={1}>
          <Suspense>
            <CodeUploadForm />
          </Suspense>
        </StepSection>
        <StepSection index={2}>
          <Suspense>
            <ContractId />
          </Suspense>
          <InitSelectorField />
          <Suspense>
            <InstantiateGasElimiation />
          </Suspense>
        </StepSection>
        <StepSection index={3}>
            <Suspense>
              <InstantiatedFinish />
            </Suspense>
        </StepSection>
      </Stepper>
    </div>
  )
}

