import type { ReactNode } from 'react'
import type { EstimateResultLike } from '../atomsWithDepositSettings'
import type { Result, U64 } from '@polkadot/types'

import React, { Suspense, useState, useEffect, useCallback } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  FormControl,
  FormLabel,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  Step,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  Stepper,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
// import { useNavigate } from '@tanstack/react-location'
import { find, path } from 'ramda'
import { CertificateData, PinkCodePromise, PinkBlueprintPromise, create, signCertificate } from '@phala/sdk'
import { Keyring } from '@polkadot/keyring'
import { ApiPromise } from '@polkadot/api'
import { Abi } from '@polkadot/api-contract'
import { BN } from '@polkadot/util'
import Decimal from 'decimal.js'
import * as R from 'ramda'

import { Select } from '@/components/inputs/select'
import { currentAccountAtom, currentAccountBalanceAtom, signerAtom } from '@/features/identity/atoms'
import {
  candidateAtom,
  currentClusterIdAtom,
  availableClusterOptionsAtom,
  candidateFileInfoAtom,
  contractSelectedInitSelectorAtom,
  phatRegistryAtom,
  localContractsAtom,
} from '../atoms'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'
import { apiPromiseAtom } from '../../parachain/atoms'
import signAndSend from '@/functions/signAndSend'


const ClusterIdSelect = () => {
  const [clusterId, setClusterId] = useAtom(currentClusterIdAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  useEffect(() => {
    if (options && options.length > 0) {
      setClusterId(prev => {
        if (!prev) {
          return options[0].value
        }
        const result = find(i => i.value === prev, options)
        if (!result) {
          return options[0].value
        }
        return prev
      })
    }
  }, [setClusterId, options])
  if (!options.length) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>RPC is not Ready</AlertTitle>
      </Alert>
    )
  }
  return (
    <Select value={clusterId} onChange={setClusterId} options={options} />
  )
}

//
//
//

const cachedCertAtom = atom<Pairs<string, CertificateData | null>>(['', null])

const hasCertAtom = atom(get => {
  const current = get(cachedCertAtom)
  const account = get(currentAccountAtom)
  return account?.address === current[0] && current[1] !== null
})

function useRequestSign() {
  const [isWaiting, setIsWaiting] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const api = useAtomValue(apiPromiseAtom)
  const account = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)
  const setCachedCert = useSetAtom(cachedCertAtom)

  useEffect(() => {
    if (api && account && signer) {
      setIsReady(true)
    } else {
      setIsReady(false)
    }
  }, [setIsReady, api, account, signer])

  const requestSign = useCallback(async () => {
    if (!api || !account) {
      throw new Error('You need connected to an endpoint & pick a account first.')
    }
    if (!signer) {
      throw new Error('Unexpected Error: you might not approve the access to the wallet extension or the wallet extension initialization failed.')
    }
    try {
      setIsWaiting(true)
      const cert = await signCertificate({ signer, account, api })
      setCachedCert([account.address, cert])
      return cert
    } catch (err) {
      return null
    } finally {
      setIsWaiting(false)
    }
  }, [api, account, signer, setIsWaiting, setCachedCert])

  return { isReady, isWaiting, requestSign }
}

const RequestCertButton = ({children}: { children: ReactNode }) => {
  const { isReady, isWaiting, requestSign } = useRequestSign()
  return (
    <Button isLoading={isWaiting} isDisabled={!isReady} onClick={requestSign}>
      {children}
    </Button>
  )
}

//
//
//

const clusterStorageDepositeMinRequiredAtom = atom(get => {
  const registry = get(phatRegistryAtom)
  const finfo = get(candidateFileInfoAtom)
  if (!registry.clusterInfo || !finfo.size) {
    return new Decimal(0)
  }
  const depositePerByte = new Decimal((registry.clusterInfo.depositPerByte?.toNumber() || 0))
  const result = depositePerByte.mul(finfo.size * 5).div(1e8)
  // if (result.toNumber() < 1) {
  //   return new Decimal(1)
  // }
  return result
})

const selectedContructorAtom = atom((get) => {
  const contract = get(candidateAtom)
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
  console.log('user choose initSelector: ', chooseInitSelector)
  console.log('default initSelector: ', defaultInitSelector)
  if (!initSelector) {
    throw new Error('No valid initSelector specified.')
  }
  return R.prop('label', R.find(i => i.selector === initSelector, spec.constructors))
})

const blueprintPromiseAtom = atom<PinkBlueprintPromise | null>(null)

const instantiatedContractIdAtom = atom<string | null>(null)

const currentAbiAtom = atom(get => {
  const candidate = get(candidateAtom)
  if (!candidate) {
    return null
  }
  const abi = new Abi(candidate)
  return abi
})

function getDefaultInitSelector(abi: Abi) {
  const defaultInitSelector = R.pipe(
    R.filter((c: ContractMetaConstructor) => c.label === 'default' || c.label === 'new'),
    R.sortBy((c: ContractMetaConstructor) => c.args.length),
    i => R.head<ContractMetaConstructor>(i),
    (i) => i ? i.selector : undefined,
  )(abi.constructors)
  return defaultInitSelector || R.head(abi.constructors)?.selector
}

const chooseInitSelectorAtom = atom(get => {
  const abi = get(currentAbiAtom)
  if (!abi || !abi.constructors.length) {
    return false
  }
  const chooseInitSelector = get(contractSelectedInitSelectorAtom)
  const defaultInitSelector = getDefaultInitSelector(abi)
  const initSelector = chooseInitSelector || defaultInitSelector
  const target = R.find(i => i.selector === initSelector, abi.constructors)
  return target?.identifier
}) 

const hasParametersAtom = atom(get => {
  const abi = get(currentAbiAtom)
  if (!abi || !abi.constructors.length) {
    return false
  }
  const chooseInitSelector = get(contractSelectedInitSelectorAtom)
  const defaultInitSelector = getDefaultInitSelector(abi)
  const initSelector = chooseInitSelector || defaultInitSelector
  const target = R.find(i => i.selector === initSelector, abi.constructors)
  if (target && target.args.length > 0) {
    return true
  }
  return false
})

const currentStepAtom = atom(get => {
  const cachedCert = get(cachedCertAtom)
  const finfo = get(candidateFileInfoAtom)
  const hasParameters = get(hasParametersAtom)
  const blueprint = get(blueprintPromiseAtom)
  const instantiatedContractId = get(instantiatedContractIdAtom)
  if (!finfo.size) {
    return 0
  }
  if (hasParameters) {
    return 1
  }
  if (cachedCert[1] === null) {
    return 2
  }
  if (instantiatedContractId) {
    return 4
  }
  if (blueprint) {
    return 3
  }
  return 2
})

const useClusterBalance = (min: number) => {
  const [currentBalance, setCurrentBalance] = useState(0)
  const [isSatisfied, setIsSatisfied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [,cert] = useAtomValue(cachedCertAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)

  const getBalance = useCallback(async () => {
    if (!registry || !currentAccount || !cert) {
      return { total: 0, free: 0 }
    }
    const { address } = currentAccount
    const system = registry.systemContract
    if (!system) {
      return { total: 0, free: 0 }
    }
    try {
      const { output: totalBalanceOf } = await system.query['system::totalBalanceOf'](address, { cert }, address)
      const { output: freeBalanceOf } = await system.query['system::freeBalanceOf'](address, { cert }, address)
      const total = (totalBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      const free = (freeBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      return { total, free }
    } catch (err) {
      console.log('getBalance', err)
      return { total: 0, free: 0 }
    }
  }, [registry, currentAccount, cert])

  useEffect(() => {
    (async function() {
      setIsLoading(true)
      const result = await getBalance()
      setCurrentBalance(result.free)
      console.log('isSatisfied', result, min)
      setIsSatisfied(result.free >= min)
      setIsLoading(false)
    })();
  }, [getBalance])

  const transfer = useCallback(async (value: Decimal) => {
    if (!currentAccount || !signer) {
      return
    }
    const rounded = Number(value.mul(1e12).toFixed(0)) + 1
    setIsLoading(true)
    try {
      const { address } = currentAccount
      await signAndSend(registry.transferToCluster(address, rounded), address, signer)
      const result = await getBalance()
      setCurrentBalance(result.free)
      console.log('isSatisfied 2', result, min)
      setIsSatisfied(result.free >= min)
    } finally {
      setIsLoading(false)
    }
  }, [registry, currentAccount, signer, setCurrentBalance, setIsLoading])

  return { currentBalance, isSatisfied, isLoading, transfer }
}

function useUploadCode() {
  const [isLoading, setIsLoading] = useState(false)
  const { requestSign } = useRequestSign()

  const [, cert] = useAtomValue(cachedCertAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const contract = useAtomValue(candidateAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)
  const setBlueprintPromise = useSetAtom(blueprintPromiseAtom)
  const constructor = useAtomValue(selectedContructorAtom)

  const upload = useCallback(async () => {
    if (!contract || !constructor) {
      return
    }
    setIsLoading(true)
    try {
      let _cert = cert
      if (!_cert) {
        _cert = await requestSign()
      }
      if (!_cert) {
        // TODO show toast.
        return
      }
      const codePromise = new PinkCodePromise(registry.api, registry, contract, contract.source.wasm)
      // @ts-ignore
      const { result: uploadResult } = await signAndSend(codePromise.tx.new({}), currentAccount.address, signer)
      await uploadResult.waitFinalized(currentAccount, _cert, 120_000)
      setBlueprintPromise(uploadResult.blueprint)
    } finally {
      setIsLoading(false)
    }
  }, [registry, contract, currentAccount, cert, constructor, setBlueprintPromise])

  return { isLoading, upload }
}

//


const TransferToCluster = () => {
  const hasCert = useAtomValue(hasCertAtom)
  const storageDepositMinRequired = useAtomValue(clusterStorageDepositeMinRequiredAtom)
  const { isLoading, transfer, isSatisfied } = useClusterBalance(storageDepositMinRequired.toNumber())
  const atLeast = storageDepositMinRequired.toNumber()
  const [value, setValue] = useState(storageDepositMinRequired)
  if (!hasCert) {
    return null
  }
  return (
    <div tw="flex flex-col gap-2">
      <div tw="flex gap-4 items-center">
        <NumberInput
          size="sm"
          defaultValue={isSatisfied ? 1 : atLeast}
          min={isSatisfied ? undefined : atLeast}
          onChange={(num) => setValue(new Decimal(num))}
        >
          <NumberInputField />
        </NumberInput>
        <Button
          // isDisabled={isLoading || value.lessThan(atLeast)}
          colorScheme="phalaDark"
          size="sm"
          onClick={() => transfer(value)}
        >
          Transfer
        </Button> 
      </div>
      <div tw="flex gap-2">
        {isLoading ? (<Spinner colorScheme="pbalaDark" size="sm" />) : null } 
      </div>
      {(!isLoading && !isSatisfied) ? (
        <div tw="text-sm px-4 py-2 border border-solid border-red-300 rounded-sm bg-red-400">You need transfer at least {atLeast} PHA to the cluster first.</div>
      ) : null}
    </div>
  )
}

const DepositionField = () => {
  const hasCert = useAtomValue(hasCertAtom)
  const storageDepositMinRequired = useAtomValue(clusterStorageDepositeMinRequiredAtom)
  const { currentBalance, isSatisfied } = useClusterBalance(storageDepositMinRequired.toNumber())
  const [showTransfer, setShowTransfer] = useState(false)
  return (
    <div tw="flex flex-col gap-4">
      <div tw="flex gap-4 items-center">
        <Suspense>
          <ClusterIdSelect />
        </Suspense>
        <Suspense>
        {hasCert ? (
          <div tw="flex flex-row items-center gap-2 h-full min-w-[14rem]">
            <span tw="text-sm">{currentBalance.toFixed(4)} PHA</span>
            <Button size="sm" onClick={() => setShowTransfer(i => !i)}>
              {showTransfer ? 'Hide' : 'Add More'}
            </Button>
          </div>
        ) : null}
        </Suspense>
      </div>
      {!isSatisfied || showTransfer ? (
        <TransferToCluster />
      ) : null}
      <div>
        {hasCert && isSatisfied ? (
          <Suspense fallback={<Button><Spinner /></Button>}>
            <UploadCodeButton />
          </Suspense>
        ) : (
          <RequestCertButton>
            <span tw="px-1">Check Balance</span>
          </RequestCertButton>
        )}
      </div>
    </div>
  )
}


function UploadCodeButton() {
  const hasCert = useAtomValue(hasCertAtom)
  const { isLoading, upload } = useUploadCode()
  return (
    <Button isLoading={isLoading} onClick={upload}>
      {!hasCert ? 'Sign Cert and Upload' : 'Upload'}
    </Button>
  )
}


function InstantiateButton() {
  const [isLoading, setIsLoading] = useState(false)
  const blueprint = useAtomValue(blueprintPromiseAtom)
  const constructor = useAtomValue(selectedContructorAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const [, cert] = useAtomValue(cachedCertAtom)
  const signer = useAtomValue(signerAtom)
  const contract = useAtomValue(candidateAtom)
  const saveContract = useSetAtom(localContractsAtom)
  const setInstantiatedContractId = useSetAtom(instantiatedContractIdAtom)
  const registry = useAtomValue(phatRegistryAtom)

  const instantiate = async () => {
    if (!blueprint || !currentAccount || !constructor) {
      return
    }
    setIsLoading(true)
    try {
      // @ts-ignore
      const { gasRequired, storageDeposit, salt } = await blueprint.query[constructor](currentAccount.address, { cert }) // Support instantiate arguments.
      console.log(registry.clusterInfo)
      let d = new Decimal(gasRequired.refTime.toNumber())
      d = d.div(new Decimal(registry.clusterInfo?.gasPrice?.toNumber() || 1)).div(1e12)
      // @ts-ignore
      const { result: instantiateResult }= await signAndSend(
      // @ts-ignore
        blueprint.tx[constructor]({ gasLimit: gasRequired.refTime, storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null, salt }),
        currentAccount.address,
        signer
      )
      await instantiateResult.waitFinalized()

      const { contractId } = instantiateResult
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      console.log('Save contract metadata to local storage.')
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} }))
      setInstantiatedContractId(contractId)
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <Button disabled={!blueprint} isLoading={isLoading} onClick={instantiate}>Instantiate</Button>
  )
}

//

function StepSection({ children, index, isEnd }: { children: ReactNode, index: number, isEnd?: boolean }) {
  const currentStep = useAtomValue(currentStepAtom)
  // if (currentStep < index) {
  //   return null
  // }
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
        (index === currentStep) ? tw`opacity-100` : tw`opacity-75 hover:opacity-100`
      ]}>
        {children}
      </div>

      {!isEnd ? (
        <StepSeparator />
      ) : null}
    </Step>
  )
}

// Step 2
function CodeUploadStep() {
  return (
    <div tw="flex flex-col gap-2">
      <Text>Choice a cluster to upload code</Text>
      <ClusterIdSelect />
      <div>
        <Suspense>
          <UploadCodeButton />
        </Suspense>
      </div>
    </div>
  )
}

// Step 3: Blueprint Promise - instantiate contract.

function InstantiateGasElimiation() {
  const blueprint = useAtomValue(blueprintPromiseAtom)
  const constructor = useAtomValue(selectedContructorAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const [, cert] = useAtomValue(cachedCertAtom)
  const signer = useAtomValue(signerAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const finfo = useAtomValue(candidateFileInfoAtom)

  const [txOptions, setTxOptions] = useState({})
  const [minClusterBalance, setMinClusterBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [clusterBalance, setClusterBalance] = useState({total: 0, free: 0})

  const getBalance = useCallback(async () => {
    if (!registry || !currentAccount || !cert) {
      return { total: 0, free: 0 }
    }
    const { address } = currentAccount
    const system = registry.systemContract
    if (!system) {
      return { total: 0, free: 0 }
    }
    try {
      const { output: totalBalanceOf } = await system.query['system::totalBalanceOf'](address, { cert }, address)
      const { output: freeBalanceOf } = await system.query['system::freeBalanceOf'](address, { cert }, address)
      const total = (totalBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      const free = (freeBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      return { total, free }
    } catch (err) {
      return { total: 0, free: 0 }
    }
  }, [registry, currentAccount, cert])

  useEffect(() => {
    if (blueprint && constructor && currentAccount && cert && signer && registry) {
      (async () => {
          setIsLoading(true)
          try {
          // @ts-ignore
          const { gasRequired, storageDeposit, salt } = await blueprint.query[constructor](currentAccount.address, { cert }) // Support instantiate arguments.
          const gasLimit = new Decimal(gasRequired.refTime.toNumber()).div(new Decimal(registry.clusterInfo?.gasPrice?.toNumber() || 1)).div(1e12)
          const storageDepositeFee = new Decimal((registry.clusterInfo?.depositPerByte?.toNumber() || 0)).mul(finfo.size * 5).div(1e8)
          setTxOptions({
            gasLimit: gasLimit.toNumber(),
            storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null,
            salt
          })
          setMinClusterBalance(gasLimit.plus(storageDepositeFee).toNumber())
          const result = await getBalance()
          setClusterBalance(result)
        } finally {
          setIsLoading(false)
        }
      })();
    }
  }, [blueprint, constructor, currentAccount, cert, signer, registry, getBalance, setTxOptions, setMinClusterBalance, setIsLoading, setClusterBalance])

  const contract = useAtomValue(candidateAtom)
  const saveContract = useSetAtom(localContractsAtom)
  const setInstantiatedContractId = useSetAtom(instantiatedContractIdAtom)

  const instantiate = async () => {
    if (!blueprint || !currentAccount || !constructor) {
      return
    }
    setIsLoading(true)
    try {
      // @ts-ignore
      const { gasRequired, storageDeposit, salt } = await blueprint.query[constructor](currentAccount.address, { cert }) // Support instantiate arguments.
      console.log(registry.clusterInfo)
      let d = new Decimal(gasRequired.refTime.toNumber())
      d = d.div(new Decimal(registry.clusterInfo?.gasPrice?.toNumber() || 1)).div(1e12)
      // @ts-ignore
      const { result: instantiateResult }= await signAndSend(
      // @ts-ignore
        blueprint.tx[constructor]({ gasLimit: gasRequired.refTime, storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null, salt }),
        currentAccount.address,
        signer
      )
      await instantiateResult.waitFinalized()

      const { contractId } = instantiateResult
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      console.log('Save contract metadata to local storage.')
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} }))
      setInstantiatedContractId(contractId)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div tw="mt-2 flex flex-col gap-2">
      <div tw="flex flex-row items-center">
        <label tw="mr-2">Minimal Cluster Balance Required:</label>
        {isLoading ? <Spinner /> : <span tw="text-sm whitespace-nowrap" title={minClusterBalance.toString()}>{minClusterBalance.toFixed(6)} PHA</span>}
      </div>
      <div tw="flex flex-row items-center">
        <label tw="mr-2">Cluster Balance:</label>
        <span tw="text-sm whitespace-nowrap" title={clusterBalance.free.toString()}>{clusterBalance.free.toFixed(6)} PHA</span>
        <Button size="xs" tw="ml-4">Charge</Button>
      </div>
      <div>
        <Button disabled={!blueprint || clusterBalance.free < minClusterBalance} isLoading={isLoading} onClick={instantiate}>Instantiate</Button>
      </div>
    </div>
  )
}

function InstantiatedFinish() {
  const instantiatedContractId = useAtomValue(instantiatedContractIdAtom)
  if (!instantiatedContractId) {
    return null
  }
  // const resetContractFileInfo = useResetAtom(candidateFileInfoAtom)
  // resetContractFileInfo()
  // resetAllowIndeterminismAtom()
  // navigate({ to: `/contracts/view/${contractId}` })
  return (
    <div>
      I will staking for computation resource later. <a href={`/contracts/view/${instantiatedContractId}`}>View it now</a>
    </div>
  )
}

//
// Final Page Composition
//

export default function FatContractUploadForm() {
  const activeStep = useAtomValue(currentStepAtom)
  return (
    <div>
      <Stepper index={activeStep} size='sm' gap='0' orientation='vertical' colorScheme="phalaDark">
        <StepSection index={0}>
          <ContractFileUpload isCheckWASM={true} />
        </StepSection>
        <StepSection index={1}>
          <CodeUploadStep />
        </StepSection>
        <StepSection index={2}>
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

