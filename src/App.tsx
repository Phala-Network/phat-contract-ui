import tw from 'twin.macro'
import { Suspense } from 'react'
import { SimpleGrid, Avatar, Button, ButtonGroup } from '@chakra-ui/react'
import { Outlet, Link } from "@tanstack/react-location"
import { useAtomValue } from 'jotai/utils'

import { signCertificate, CertificateData } from './sdk'

import { rpcApiInstanceAtom, rpcEndpointAtom, useConnectApi } from './atoms/foundation'
import type { FoundationProviderProps } from '@/foundation/Provider'
import FoundationProvider from '@/foundation/Provider'
import AccountBadge from '@/features/account/Badge'
import AccountMenu from '@/features/account/account-menu'
import FatContractUploadForm from '@/features/instantiate/fat-contract-upload-form'
import EventDisplay from '@/features/system-events/event-display'
import { derviedContractAtom, contractsAtom } from '@/features/fat-contract/atoms'
import { lastSelectedAccountAtom, signerAtom } from '@/features/account/atoms'

import ContractAddPage from '@/pages/contract-add-page'
import ContractListPage from '@/pages/contract-list-page'
import ContractInfoPage from '@/pages/contract-info-page'
import ComponentListPage from '@/pages/component-list-page'

const endpoint = 'wss://poc5.phala.network/ws';
// const endpoint = 'wss://rococo-canvas-rpc.polkadot.io';

const initialValues: FoundationProviderProps["initialValues"] = [
  [rpcEndpointAtom, endpoint],
]

// const ConnectionIndicator = () => {
//   useConnectApi()
//   return (
//     <div />
//   )
// }

/*
<SimpleGrid columns={{sm: 1, md: 2}} spacing={0} mt="2" maxW="7xl" mx="auto">
  <FatContractUploadForm />
  <EventDisplay />
</SimpleGrid>

const ContractInteractive = () => {
  const contract = useAtomValue(derviedContractAtom)
  const api = useAtomValue(rpcApiInstanceAtom)
  const account = useAtomValue(lastSelectedAccountAtom)
  const signer = useAtomValue(signerAtom)
  // console.log('ContractPromise', contract)
  const contracts = useAtomValue(contractsAtom)
  console.log(contracts)

  const onQuery = async () => {
    if (account && api && contract && signer) {
      console.log('onQuery call')
      try {
        // const signer = await getSigner(account)

        // Save certificate data to state, or anywhere else you want like local storage
        // setCertificateData(
        const certificateData = await signCertificate({
          api,
          account,
          signer,
        })
        const { output } = await contract.query.get(certificateData as any, {})
        // eslint-disable-next-line no-console
        console.log('contract query get', output?.toHuman())
        // )
        // toaster.positive('Certificate signed', {})
      } catch (err) {
        console.log('onQuery error', err)
        // toaster.negative((err as Error).message, {})
      }
    }
  }

  const onCommand = async () => {
    if (!contract || !account || !signer) return
    console.log('onCommand call')
    // const signer = await getSigner(account)
    contract.tx.flip({}).signAndSend(account.address, {signer}, (status) => {
      console.log('flip signAndSend:', status)
      // if (status.isInBlock) {
        // toaster.positive('In Block', {})
      // }
    })
  }

  return (
    <div>
      <ButtonGroup>
        <Button disabled={!account} onClick={onQuery}>
          Query
        </Button>
        <Button disabled={!account} onClick={onCommand}>
          Flip
        </Button>
      </ButtonGroup>
    </div>
  )
}

const Home = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <ContractInteractive />
      </Suspense>
    </div>
  )
}
*/

const AppHeader = () => {
  return (
    <div tw="bg-black">
      <header tw="mx-auto w-full max-w-7xl md:flex md:items-center md:justify-between py-4">
        <div tw="flex-1 min-w-0">
          <h2 tw="text-2xl font-bold leading-7 text-white font-mono">
            <Link tw="text-phala-500" to="/">PHALA Contracts UI</Link>
          </h2>
        </div>
        <div tw="mt-4 flex md:mt-0 md:ml-4">
          <AccountBadge />
        </div>
      </header>
    </div>
  )
}

function App() {
  return (
    <FoundationProvider
      initialValues={initialValues}
      routes={[
        { path: "/", element: <ContractListPage /> },
        { path: "/contracts/add", element: <ContractAddPage /> },
        { path: "/contracts/view/:contractId", element: <ContractInfoPage /> },
        { path: "/components", element: <ComponentListPage /> },
      ]}
    >
      <AppHeader />
      <div tw="mx-auto w-full max-w-7xl md:flex md:items-center md:justify-between py-8">
        <Outlet />
      </div>
    </FoundationProvider>
  )
}

export default App