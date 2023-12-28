import React, { Suspense, useMemo } from 'react'
import tw, { styled } from 'twin.macro'
import { useAtomValue } from 'jotai'
import { AnimatePresence, motion } from 'framer-motion'
import { GoDotFill } from 'react-icons/go'
import {HiOutlineDotsVertical as MenuIcon} from 'react-icons/hi'
import { ButtonGroup, Button, ButtonProps } from '@chakra-ui/react'
import { Identicon } from '@polkadot/react-identicon'

import { isDevChainAtom } from '@/features/parachain/atoms'
import { useCurrentAccountBalance, injectedWalletAtom } from '@/atoms/core'
import { formatPha, formatAddress } from '@/features/phala-web/formatters'

function useAccountInfo() {
  const injectedWallet = useAtomValue(injectedWalletAtom)
  return useMemo(() => {
    const address = injectedWallet.provider?.address || injectedWallet.lastSelectedAddress
    if (injectedWallet.injectedAccountInfo) {
      return {
        address,
        name: injectedWallet.injectedAccountInfo.name,
        isEvmAccountMapping: false,
      }
    }
    return {
      address,
      name: formatAddress(address || ''),
      isEvmAccountMapping: injectedWallet.lastSelectedWallet === 'ethereum',
    }
  }, [injectedWallet])
}

//
//
//

const ConnectStatusDot = styled(GoDotFill)<{
  connected?: string
}>`
  ${tw`w-4 h-4`}
  ${({ connected }) => !!connected ? tw`text-green-600` : tw`text-gray-600`}
`

const StyledChainName = tw.span`text-gray-300 font-mono text-xs font-extralight ml-1`

const RuntimeChainName = () => {
  const isDev = useAtomValue(isDevChainAtom)
  if (!isDev) {
    return null
  }
  return (
    <StyledChainName>testnet</StyledChainName>
  )
}

const EndpointSwitchButton = ({ compact, onClick }: { compact?: boolean, onClick?: React.MouseEventHandler<HTMLButtonElement> }) => {
  return (
    <Button variant="unstyled" tw="flex flex-row items-center pl-3" onClick={onClick}>
      <Suspense
        fallback={
          <>
            <ConnectStatusDot />
            {!compact && (
              <StyledChainName>Disconnected</StyledChainName>
            )}
          </>
        }
      >
        <ConnectStatusDot connected="1" />
        <RuntimeChainName />
      </Suspense>
    </Button>
  )
}

const BalanceMotionContainer = tw(motion.div)`
  font-mono text-sm ml-1 mr-2 overflow-hidden whitespace-nowrap
`

const Balance = () => {
  const balance = useCurrentAccountBalance()
  if (!balance) {
    const href = 'https://docs.phala.network/introduction/basic-guidance/get-pha-and-transfer'
    return (
      <div tw="hidden xl:block">
        <BalanceMotionContainer initial={{ width: 0 }} animate={{ width: 'auto' }} exit={{ width: 0 }} tw="mx-0">
          <Button
            as="a"
            href={href}
            target="_blank"
            rel="noopener noreferer"
            mr="1"
            size="sm"
            rounded="sm"
            color="gray.100"
            bg="transparent"
            _hover={tw`bg-phalaDark text-black`}
          >
            Get PHA
          </Button>
        </BalanceMotionContainer>
      </div>
    )
  }
  const [whole, fragction] = formatPha(balance).split('.')
  return (
    <div tw="hidden xl:block">
      <BalanceMotionContainer initial={{ width: 0 }} animate={{ width: 'auto' }} exit={{ width: 0 }}>
        <big>{whole}</big>
        {fragction ? (
          <>
            <span>.</span>
            <small tw="text-gray-400">{fragction}</small>
          </>
        ) : null}
        <span tw="ml-2 text-gray-400">PHA</span>
      </BalanceMotionContainer>
    </div>
  )
}

const StyledAccountName = tw(Button)`font-sans`

const DisconnectedAccountName = (props: Omit<ButtonProps, "as">) => {
  const info = useAccountInfo()
  return (
    <StyledAccountName {...props} fontSize="sm" h="8">
      <span tw="xl:hidden">
        <MenuIcon />
      </span>
      <span tw="hidden xl:inline-flex pointer-events-none gap-1.5 items-center">
        <div tw="relative w-5 h-5 rounded-full overflow-hidden">
          <Identicon size={20} value={info.address} theme={info.isEvmAccountMapping ? "ethereum" : "polkadot"} />
        </div>
        {(!info.address) ? "Connect Wallet" : `${info.name}`}
      </span>
    </StyledAccountName>
  )
}

const CurrentAccountName = (props: Omit<ButtonProps, "as">) => {
  const info = useAccountInfo()
  return (
    <StyledAccountName {...props} fontSize="sm" h="8">
      <span tw="xl:hidden">
        <MenuIcon />
      </span>
      <span tw="hidden xl:inline-flex pointer-events-none gap-1.5 items-center">
        <div tw="relative w-5 h-5 rounded-full overflow-hidden">
          <Identicon size={20} value={info.address} theme={info.isEvmAccountMapping ? "ethereum" : "polkadot"} />
        </div>
        {(!info.address) ? "Connect Wallet" : `${info.name}`}
      </span>
    </StyledAccountName>
  )
}

const StyledButtonGroup = styled.div`
  border-image-slice: 1;
  border-width: 1px;
  border-image-source: linear-gradient(90deg, #2B481E 0%, #233A18 100%);
  border-radius: 2px;
  background: #000;
`

export interface AccessPointComboProps {
  onConnectionStatusClick?: React.MouseEventHandler<HTMLButtonElement>
  onAccountClick: () => void
}

export default function AccessPointCombo({ onConnectionStatusClick, onAccountClick }: AccessPointComboProps) {
  return (
    <ButtonGroup as={StyledButtonGroup}>
      <EndpointSwitchButton compact onClick={onConnectionStatusClick} />
      <div tw="flex flex-row items-center bg-gray-900 h-full p-1 rounded-l-sm">
        <AnimatePresence mode="wait">
          <Suspense fallback={null}>
            <Balance />
          </Suspense>
        </AnimatePresence>
        <Suspense fallback={<DisconnectedAccountName onClick={onAccountClick} />}>
          <CurrentAccountName onClick={onAccountClick} />
        </Suspense>
      </div>
    </ButtonGroup>
  )
}