import tw from 'twin.macro'
import { Suspense } from 'react'
import { SimpleGrid, Avatar } from '@chakra-ui/react'
import {
  Outlet,
} from "@tanstack/react-location"

import { rpcEndpointAtom, useConnectApi } from './atoms/foundation'
import type { FoundationProviderProps } from '@/foundation/Provider'
import FoundationProvider from '@/foundation/Provider'
import AccountMenu from '@/features/account/account-menu'
import FatContractUploadForm from '@/features/instantiate/fat-contract-upload-form'
import EventDisplay from '@/features/system-events/event-display'

const endpoint = 'wss://poc5.phala.network/ws';
// const endpoint = 'wss://rococo-canvas-rpc.polkadot.io';

const initialValues: FoundationProviderProps["initialValues"] = [
  [rpcEndpointAtom, endpoint],
]

const ConnectionIndicator = () => {
  useConnectApi()
  return (
    <div />
  )
}

/*
<SimpleGrid columns={{sm: 1, md: 2}} spacing={0} mt="2" maxW="7xl" mx="auto">
  <FatContractUploadForm />
  <EventDisplay />
</SimpleGrid>
*/

const Home = () => {
  return (
    <div>Home</div>
  )
}

function App() {
  return (
    <FoundationProvider
      initialValues={initialValues}
      routes={[
        { path: "/", element: <Home /> },
      ]}
    >
      <div tw="min-h-full">
        <div tw="bg-phalaDark-600 pb-32">
          <div tw="flex flex-row justify-between items-center pt-4 mx-8 pb-4 border-b border-gray-700">
            <div tw="text-xl text-black font-bold leading-none">PHALA Contracts UI</div>
            <Suspense fallback={<div />}>
              <div>
                <AccountMenu />
                <ConnectionIndicator />
              </div>
            </Suspense>
          </div>
        </div>
        <div tw="-mt-32 px-8 py-4">
          <Outlet />
        </div>
      </div>
    </FoundationProvider>
  )
}

export default App