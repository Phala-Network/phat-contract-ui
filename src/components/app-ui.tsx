import { FC, ReactNode } from 'react'

import React, { useCallback } from 'react'
import { Link } from "@tanstack/react-location"
import tw, { styled } from 'twin.macro'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useAutoConnect } from '@/features/parachain/atoms'
import { lastSelectedWeb3ProviderAtom, useRestoreLastSelectedAccount } from '@/features/identity/atoms'
import AccessPointCombo from '@/components/AccessPointCombo'
import EndpointInfoModal, { connectionDetailModalVisibleAtom } from './EndpointInfo'
import Logo from './Logo'
import ScrollContainer from '@/components/ScrollContainer'
import { WalletModal, walletModalVisibleAtom } from './ConnectWalletModal'

export const walletSelectModalVisibleAtom = atom(false) 

export const accountSelectModalVisibleAtom = atom(false)

export const useShowAccountSelectModal = () => {
  const setWalletSelectModalVisible = useSetAtom(walletSelectModalVisibleAtom)
  const setAccountSelectModalVisible = useSetAtom(accountSelectModalVisibleAtom)
  const currentProvider = useAtomValue(lastSelectedWeb3ProviderAtom)
  return useCallback(() => {
    if (currentProvider) {
      setAccountSelectModalVisible(true)
    } else {
      setWalletSelectModalVisible(true)
    }
  }, [setWalletSelectModalVisible, setAccountSelectModalVisible, currentProvider])
}

export const AppUI = styled.div`
  ${tw`flex flex-col max-h-full h-full overflow-y-hidden`}
  justify-content: safe center;
`

export const AppHeader: FC<{
  title?: string
  left?: ReactNode
}> = ({ title = 'PHALA', left }) => {
  useRestoreLastSelectedAccount()
  useAutoConnect()
  const setWalletModalVisible = useSetAtom(walletModalVisibleAtom)
  const setEndpointInfoVisible = useSetAtom(connectionDetailModalVisibleAtom)
  return (
    <div tw='bg-black py-2'>
      <header tw="mx-auto w-full max-w-7xl md:flex md:items-center md:justify-between py-2">
        <div tw="flex flex-row gap-4 items-center">
          <Link to="/" tw="w-32 aspect-[128/72] flex flex-row items-center">
            <Logo />
          </Link>
          <a
            href="https://dashboard.phala.network"
            tw="rounded-sm px-8 py-2 bg-transparent text-white font-medium hover:bg-gray-700 transition-all"
          >
            Dashboard
          </a>
          <Link
            to="/"
            tw="rounded-sm px-8 py-2 bg-transparent text-white font-medium hover:bg-gray-700 transition-all"
          >
            DevTool
          </Link>
        </div>
        <div tw="mt-4 flex flex-row items-center justify-center gap-1 md:mt-0 md:ml-4">
          <AccessPointCombo
            onAccountClick={() => setWalletModalVisible(true)}
            onConnectionStatusClick={() => setEndpointInfoVisible(true)}
          />
        </div>
      </header>
      <WalletModal />
      <EndpointInfoModal />
    </div>
  )
}

export const AppContainer: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ScrollContainer css={tw`
      py-8
      flex-grow
      flex-col items-start justify-start
      overflow-y-scroll
    `}>
      <div tw='mx-auto w-full max-w-7xl'>
        {children}
      </div>
    </ScrollContainer>
  )
}