import { Outlet } from "@tanstack/react-location"

import FoundationProvider from '@/foundation/Provider'
import { AppUI, AppHeader, AppContainer } from '@/components/app-ui'
import StatusBar from '@/components/StatusBar'

import ContractAddPage from '@/pages/contract-add-page'
import ContractAttachPage from '@/pages/contract-attach-page'
import ContractListPage from '@/pages/contract-list-page'
import ContractInfoPage from '@/pages/contract-info-page'

export default function PhalaContractsUI() {
  return (
    <FoundationProvider
      routes={[
        { path: "/", element: <ContractListPage /> },
        { path: "/contracts/add/:codeHash", element: <ContractAddPage /> },
        { path: "/contracts/add", element: <ContractAddPage /> },
        { path: "/contracts/attach", element: <ContractAttachPage /> },
        { path: "/contracts/view/:contractId", element: <ContractInfoPage /> },
      ]}
    >
      <AppUI>
        <AppHeader
          title="Phat Contract UI"
        />
        <AppContainer>
          <Outlet />
        </AppContainer>
        <StatusBar />
      </AppUI>
    </FoundationProvider>
  )
}
