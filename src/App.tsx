import tw from 'twin.macro'
import { SimpleGrid } from '@chakra-ui/react'

import { rpcEndpointAtom } from './atoms/foundation'
import type { FoundationProviderProps } from '@/foundation/Provider'
import FoundationProvider from '@/foundation/Provider'
import FatContractUploadForm from '@/features/fat-contract/fat-contract-upload-form'
import EventDisplay from '@/features/system-events/event-display'

const endpoint = 'wss://poc5.phala.network/ws';
// const endpoint = 'wss://rococo-canvas-rpc.polkadot.io';

const initialValues: FoundationProviderProps["initialValues"] = [
  [rpcEndpointAtom, endpoint],
]

function App() {
  return (
    <FoundationProvider initialValues={initialValues}>
      <SimpleGrid columns={{sm: 1, md: 2}} spacing={0} mt="2" maxW="7xl" mx="auto">
        <FatContractUploadForm />
        <EventDisplay />
      </SimpleGrid>
    </FoundationProvider>
  )
}

export default App