import tw from 'twin.macro'

import { rpcEndpointAtom } from './atoms/foundation'
import type { FoundationProviderProps } from '@/foundation/Provider'
import FoundationProvider from '@/foundation/Provider'
import FatContractUploadForm from '@/features/fat-contract/fat-contract-upload-form'

const endpoint = 'wss://poc5.phala.network/ws';
// const endpoint = 'wss://rococo-canvas-rpc.polkadot.io';

const initialValues: FoundationProviderProps["initialValues"] = [
  [rpcEndpointAtom, endpoint],
]

function App() {
  return (
    <FoundationProvider initialValues={initialValues}>
      <div className="App">
        <FatContractUploadForm />
      </div>
    </FoundationProvider>
  )
}

export default App