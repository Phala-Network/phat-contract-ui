import type { ReactNode } from 'react'

import React, { useState } from 'react'
import tw, { css } from 'twin.macro'
import { atom, useAtom, useAtomValue } from 'jotai'
import { Identicon } from '@polkadot/react-identicon'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react'


import { injectedWalletAtom, isEvmMappingPalletSupportedAtom } from '@/atoms/core'

export const walletModalVisibleAtom = atom(false)

function WalletButton({ onClick, installed, version, active, children }: {
  onClick: () => void
  installed?: boolean
  version?: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      css={css(
        tw`flex flex-row items-end justify-between py-2 px-4 rounded w-full`,
        tw`border border-solid border-transparent hover:border-gray-600 hover:bg-gray-600`,
        tw`transform-gpu transition-all`,
        !installed && tw`text-gray-500 hover:text-gray-200 hover:cursor-alias`,
        active && tw`border-phat-400 bg-phat-400/70 text-white`,
      )}
      onClick={onClick}
    >
      <div tw="flex flex-row items-center gap-2">
        {children}
      </div>
      {installed ? (
        <div tw="text-sm text-gray-300">
          {version}
        </div>
      ) : null}
    </button>
  )
}

export function WalletModal() {
  const [visible, setVisible] = useAtom(walletModalVisibleAtom)
  const [{ wallets, accounts, lastSelectedWallet, lastSelectedAccount, isReady }, dispatch] = useAtom(injectedWalletAtom)
  const [selected, setSelected] = useState('')
  const isEvmMappingPalletSupported = useAtomValue(isEvmMappingPalletSupportedAtom)
  return (
    <Modal isOpen={visible} onClose={() => setVisible(false)}>
      <ModalOverlay />
      <ModalContent tw='max-w-4xl'>
        <ModalHeader tw="flex flex-row justify-between items-center">
          Connect a Wallet
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <div tw="flex flex-col gap-5 mb-4">
            {lastSelectedAccount && !isReady ? (
              <div tw="flex flex-row items-center justify-stretch gap-2.5 py-2 px-4 rounded w-full border border-solid border-gray-600">
                <div tw="relative w-10 h-10 rounded-full overflow-hidden">
                  <Identicon size={40} value={lastSelectedAccount} theme={lastSelectedWallet === "ethereum" ? "ethereum" : "polkadot"} />
                </div>
                <div tw="flex flex-col">
                  <span tw="tracking-wide">{lastSelectedAccount}</span>
                  <code tw="font-light text-xs font-mono text-gray-400 tracking-wider">{lastSelectedWallet}</code>
                </div>
                <button
                  tw="btn btn-phat btn-sm rounded-lg ml-auto"
                  onClick={async () => {
                    try {
                      await dispatch({ type: 'restore' })
                      setVisible(false)
                    } catch (_err) {
                    }
                  }}
                >
                  restore
                </button>
              </div>
            ) : null}
            <div tw="flex flex-row gap-8 w-full">
              <div tw="py-2">
                <ul tw="flex flex-col gap-2.5 min-w-[16rem]">
                  {isEvmMappingPalletSupported ? (
                  <li>
                    <WalletButton
                      installed={!!(typeof window !== 'undefined' && (window as any)?.ethereum)}
                      active={selected ? 'ethereum' === selected : 'ethereum' === lastSelectedWallet}
                      onClick={async () => {
                        try {
                          await dispatch({ type: 'signinWithEthereum' })
                          setVisible(false)
                        } catch (_err) {
                        }
                      }}
                    >
                      <img src="/illustrations/faucet/metamask.png" alt="" tw="w-6" />
                      MetaMask
                      <span tw="ml-2 rounded-2xl bg-phalaPurple-400 text-white text-xs font-medium px-4">BETA</span>
                    </WalletButton>
                  </li>
                  ) : null}
                  {wallets.map((wallet, idx) => (
                    <li key={idx}>
                      <WalletButton
                        active={selected ? wallet.key === selected : wallet.key === lastSelectedWallet}
                        installed={wallet.installed}
                        version={wallet.version}
                        onClick={() => {
                          setSelected(wallet.key)
                          if (!wallet.installed) {
                            window.open(wallet.downloadUrl, '_blank')
                          } else {
                            dispatch({ type: 'setWallet', walletName: wallet.name })
                          }
                        }}
                      >
                        <img src={wallet.icon} alt="" tw="w-6" />
                        {wallet.name}
                      </WalletButton>
                    </li>
                  ))}
                </ul>
              </div>
              <div tw="border-l border-solid border-gray-600 h-[20rem] w-full">
                {selected || (lastSelectedWallet && lastSelectedWallet !== 'ethereum') ? (
                  <ul tw="h-[20rem] overflow-y-scroll px-4 w-full flex flex-col gap-0.5">
                    {accounts.map((account, idx) => (
                      <li key={idx}>
                        <div
                          css={css(
                            tw`flex flex-row items-center gap-4 py-2 px-4 rounded w-full`,
                            tw`border border-solid border-transparent text-white transition-all`,
                            tw`hover:border-gray-600 hover:bg-gray-600`,
                            account.address === lastSelectedAccount && tw`border-phat-400 bg-phat-400/70`,
                          )}
                        >
                          <div tw="relative">
                            <Identicon size={40} value={account.address} theme="polkadot" />
                          </div>
                          <button
                            tw="flex flex-col items-start"
                            onClick={async () => {
                              try {
                                await dispatch({ type: 'setPolkadotAccount', account })
                                setVisible(false)
                              } catch (_err) {
                              }
                            }}
                          >
                            <span tw="tracking-wide">{account.name}</span>
                            <code
                              css={css(
                                tw`font-light text-xs font-mono text-gray-400 tracking-wider`,
                                account.address === lastSelectedAccount && tw`text-white/60`,
                              )}
                            >
                              {account.address}
                            </code>
                          </button>
                        </div>
                      </li>
                    )
                    )}
                  </ul>
                ) : (
                  <div tw="p-8 flex flex-col gap-8">
                    <h3 tw="text-xl font-medium">What is a Wallet?</h3>
                    <div tw="flex flex-col gap-5">
                      <div>
                        <h4 tw="text-lg font-medium mb-2">A Home for your Digital Assets</h4>
                        <p tw="text-sm font-light text-gray-200">Wallets are used to send, receive, store, and display digital assets like Ethereum and NFTs.</p>
                      </div>
                      <div>
                        <h4 tw="text-lg font-medium mb-2">A New Way to Log In</h4>
                        <p tw="text-sm font-light text-gray-200">Instead of creating new accounts and passwords on every website, just connect your wallet.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

