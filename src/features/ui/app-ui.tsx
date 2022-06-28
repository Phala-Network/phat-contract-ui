import type { FC, ReactNode } from 'react'

import tw, { styled } from 'twin.macro'
import { Link } from "@tanstack/react-location"

export const AppUI = styled.div`
  ${tw`flex flex-col max-h-full h-full overflow-y-hidden`}
  justify-content: safe center;
`

export const AppHeader: FC<{
  title?: string
  left?: ReactNode
  right?: ReactNode
}> = ({ title = 'PHALA', left, right }) => {
  return (
    <div tw="bg-black">
      <header tw="mx-auto w-full max-w-7xl md:flex md:items-center md:justify-between py-2">
        <div tw="flex-1 min-w-0">
          {left ? left : (
            <h2 tw="text-2xl font-bold leading-7 text-white font-heading">
              <Link tw="text-phala-500" to="/">{title}</Link>
            </h2>
          )}
        </div>
        <div tw="mt-4 flex md:mt-0 md:ml-4">
          {right}
        </div>
      </header>
    </div>
  )
}

export const AppContainer: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div css={tw`
      py-8
      flex-grow
      flex-col items-start justify-start
      overflow-y-scroll
    `}>
      <div tw='mx-auto w-full max-w-7xl'>
        {children}
      </div>
    </div>
  )
}