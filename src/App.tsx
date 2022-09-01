import type { FoundationProviderProps } from '@/foundation/Provider'

import { Outlet } from "@tanstack/react-location"

import { rpcEndpointAtom } from './features/chain/atoms'
import FoundationProvider from '@/foundation/Provider'
import { AppUI, AppHeader, AppContainer } from '@/features/ui/app-ui'
import StatusBar from '@/features/status-bar/status-bar'
import AccountBadge from '@/features/account/Badge'

import ContractAddPage from '@/pages/contract-add-page'
import ContractListPage from '@/pages/contract-list-page'
import ContractInfoPage from '@/pages/contract-info-page'
import ComponentListPage from '@/pages/component-list-page'

const endpoint = 'wss://poc5.phala.network/ws';
// const endpoint = 'wss://rococo-canvas-rpc.polkadot.io';

const initialValues: FoundationProviderProps["initialValues"] = [
  [rpcEndpointAtom, endpoint],
]

export default function PhalaContractsUI() {
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
      <AppUI>
        <AppHeader
          title="Phat Contract UI"
          right={<AccountBadge />}
        />
        <AppContainer>
          <Outlet />
        </AppContainer>
        <StatusBar />
      </AppUI>
    </FoundationProvider>
  )
}
