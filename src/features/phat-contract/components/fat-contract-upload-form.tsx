import type { FC, ReactNode } from 'react'
import type { EstimateResultLike } from '../atomsWithDepositSettings'

import React, { Suspense, useState, useEffect } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  VStack,
  useToast,
  FormControl,
  FormLabel,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  Input,
  InputGroup,
  InputRightAddon,
  FormHelperText,
  Checkbox,
} from '@chakra-ui/react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { useResetAtom, waitForAll } from 'jotai/utils'
import { useNavigate } from '@tanstack/react-location'
import { find, path } from 'ramda'
import { create, signCertificate } from '@phala/sdk'
import { Keyring } from '@polkadot/keyring'
import { ApiPromise } from '@polkadot/api'
import { BN } from '@polkadot/util'

import { Select } from '@/components/inputs/select'
import { currentAccountAtom, currentAccountBalanceAtom } from '@/features/identity/atoms'
import {
  candidateAtom,
  currentClusterIdAtom,
  currentClusterAtom,
  availableClusterOptionsAtom,
  candidateFileInfoAtom,
  pruntimeURLAtom,
  instantiateTimeoutAtom,
  currentWorkerIdAtom,
  currentSystemContractIdAtom,
  contractSelectedInitSelectorAtom,
  candidateAllowIndeterminismAtom,
} from '../atoms'
import useUploadCodeAndInstantiate from '../hooks/useUploadCodeAndInstantiate'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'
import { atomsWithDepositSettings } from '../atomsWithDepositSettings'
import { apiPromiseAtom } from '../../parachain/atoms'


const instantiateEstimateGasAtom = atom(async get => {
  const apiPromise = get(apiPromiseAtom)
  const pruntimeURL = get(pruntimeURLAtom)
  const remotePubkey = get(currentWorkerIdAtom)
  const systemContractId = get(currentSystemContractIdAtom)
  const candidate = get(candidateAtom)
  const initSelector = get(contractSelectedInitSelectorAtom)
  const clusterInfo = get(currentClusterAtom)
  if (!systemContractId || !candidate || !clusterInfo) {
    return { gasLimit: new BN(0), storageDepositLimit: null } as EstimateResultLike
  }
  const { instantiate } = await create({
    // api: await api.clone().isReady,
    // @ts-ignore
    api: await ApiPromise.create({ ...apiPromise._options }),
    baseURL: pruntimeURL,
    contractId: systemContractId,
    remotePubkey: remotePubkey,
  })
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromUri('//Alice')
  const cert = await signCertificate({ api: apiPromise as unknown as Parameters<typeof signCertificate>[0]['api'], pair })
  const raw = await instantiate({
    // @ts-ignore
    codeHash: candidate.source.hash,
    salt: '0x' + new Date().getTime(),
    instantiateData: initSelector,
    deposit: 0,
    transfer: 0,
  }, cert)
  const response = apiPromise.createType('InkResponse', raw)
  const rawReturns = path(['nonce', 'result', 'ok', 'inkMessageReturn'], response.toJSON())
  const returns = apiPromise.createType('ContractInstantiateResult', rawReturns)
  // @ts-ignore
  const { gasRequired, storageDeposit } = returns
  const options: EstimateResultLike = {
    gasLimit: (gasRequired as any).refTime,
    storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null,
    gasPrice: clusterInfo.gasPrice,
  }
  return options
})

const [depositSettingsValueAtom, depositSettingsControlsAtom] = atomsWithDepositSettings(instantiateEstimateGasAtom)


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

const SuspenseFormField: FC<{ label: string, children: ReactNode }> = ({ label, children }) => {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <div>
        <Suspense fallback={<Skeleton height="40px" />}>
          {children}
        </Suspense>
      </div>
    </FormControl>
  )
}

const InstantiateTimeoutField = () => {
  const [instantiateTimeout, setInstantiateTimeout] = useAtom(instantiateTimeoutAtom)
  return (
    <FormControl>
      <FormLabel>Instantiate Timeout</FormLabel>
      <div tw="flex flex-row gap-1 max-w-[16rem]">
        <InputGroup>
          <Input onChange={ev => setInstantiateTimeout(parseInt(ev.target.value, 10))} value={instantiateTimeout} type="number" inputMode="decimal" />
          <InputRightAddon children="secs" />
        </InputGroup>
        <Button onClick={() => setInstantiateTimeout(60)}>Reset</Button>
      </div>
      <FormHelperText>Set up wait timeout for polling updates from chain, default 60 secs.</FormHelperText>
    </FormControl>
  )
}

const gasLimitPlaceholder = (new BN('1000000000000')).div(new BN(1e12)).toString()

const DepositSettingsFieldset = () => {
  const [value, update] = useAtom(depositSettingsControlsAtom)
  let gasLimit = gasLimitPlaceholder
  if (value.gasLimit) {
    gasLimit = `${(new BN(value.gasLimit)).div(new BN(value.gasPrice || 1)).div(new BN(1e10)).toNumber() / 100}`
  }
  if (value.autoDeposit) {
    return (
      <>
        <Checkbox isChecked onChange={() => update({ autoDeposit: false })}>
          Auto-deposit
        </Checkbox>
        <dl tw='text-xs flex flex-col gap-1 mt-2'>
          <div tw='flex flex-row'>
            <dt tw='text-gray-500 min-w-[6.5rem]'>Gas</dt>
            <dd>{gasLimit} PHA</dd>
          </div>
          <div tw='flex flex-row'>
            <dt tw='text-gray-500 min-w-[6.5rem]'>Storage Deposit</dt>
            <dd>{value.storageDepositLimit || ''}</dd>
          </div>
        </dl>
      </>
    )
  }
  return (
    <>
      <Checkbox onChange={() => update({ autoDeposit: true })}>
        Auto-deposit
      </Checkbox>
      <div tw='flex flex-col gap-2 mt-2'>
        <FormControl>
          <FormLabel tw='text-xs'>
            Gas Limit
          </FormLabel>
          <div>
            <Input
              size="sm"
              maxW="12rem"
              defaultValue={`${1e12}`}
              value={(value.gasLimit === null || value.gasLimit === undefined || value.gasLimit === 0) ? undefined : `${value.gasLimit}`}
              onChange={({ target: { value } }) => {
                update({ gasLimit: value === '' ? null : Number(value) })
              }}
            />
            <span tw='ml-2 text-xs'>{new BN(value.gasLimit || 1e12).div(new BN(value.gasPrice || 1)).div(new BN(1e10)).toNumber() / 100} PHA</span>
          </div>
        </FormControl>
        <FormControl>
          <FormLabel tw='text-xs'>
            Storage Deposit Limit
          </FormLabel>
          <Input
            size="sm"
            maxW="12rem"
            value={(value.storageDepositLimit === null || value.storageDepositLimit === undefined) ? '' : `${value.storageDepositLimit}`}
            onChange={({ target: { value } }) => {
              update({ storageDepositLimit: value === '' ? null : Number(value) })
            }}
          />
        </FormControl>
      </div>
    </>
  )
}

const DepositSettingsField = () => {
  return (
    <div>
      <FormControl>
        <FormLabel>
          Gas Limit
        </FormLabel>
        <div tw="pb-4">
          <Suspense fallback={
            <Checkbox isReadOnly isChecked>
              <span tw='flex flex-row gap-2 items-center'>
                <span tw='text-gray-400'>Auto-deposit</span>
                <Spinner size="xs" />
              </span>
            </Checkbox>
          }>
            <DepositSettingsFieldset />
          </Suspense>
        </div>
      </FormControl>
    </div>
  )
}

const SubmitButton = () => {
  const [account, candidate, clusterId, pruntime] = useAtomValue(waitForAll([
    currentAccountAtom,
    candidateAtom,
    currentClusterIdAtom,
    pruntimeURLAtom,
  ]))
  const balance = useAtomValue(currentAccountBalanceAtom)
  const resetContractFileInfo = useResetAtom(candidateFileInfoAtom)
  const resetAllowIndeterminismAtom = useResetAtom(candidateAllowIndeterminismAtom)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const uploadCodeAndInstantiate = useUploadCodeAndInstantiate()
  const navigate = useNavigate()
  const depositSettings = useAtomValue(depositSettingsValueAtom)
  
  const isDisabled = !(clusterId && pruntime && balance.gt(1))
  
  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      if (!account) {
        toast({
          title: 'Please select an account first.',
          status: 'error',
          duration: 9000,
          isClosable: true,
        })
        return
      }
      if (!candidate) {
        toast({
          title: 'Please choose a contract file first.',
          status: 'error',
          duration: 9000,
          isClosable: true,
        })
        return
      }
      if (account && candidate) {
        const contractId = await uploadCodeAndInstantiate(account, candidate, clusterId, depositSettings)
        resetContractFileInfo()
        resetAllowIndeterminismAtom()
        if (contractId) {        
          navigate({ to: `/contracts/view/${contractId}` })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <Button size="lg" onClick={handleSubmit} isDisabled={isDisabled} isLoading={isLoading}>
      Submit
    </Button>
  )
}

const FatContractUploadForm = () => {
  return (
    <div>
      <VStack
        my={4}
        p={4}
        spacing={4}
        align="left"
        bg="gray.700"
      >
        <ContractFileUpload isCheckWASM={true} />
        <InitSelectorField />
        <SuspenseFormField label="Cluster ID">
          <ClusterIdSelect />
        </SuspenseFormField>
        <InstantiateTimeoutField />
        <DepositSettingsField/>
      </VStack>
      <div tw="mb-4 w-full flex justify-end">
        <Suspense fallback={<Button><Spinner /></Button>}>
          <SubmitButton />
        </Suspense>
      </div>
    </div>
  )
}

export default FatContractUploadForm
