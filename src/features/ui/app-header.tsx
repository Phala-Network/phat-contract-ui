import tw from 'twin.macro'
import { Link } from "@tanstack/react-location"

import AccountBadge from '@/features/account/Badge'

export default function AppHeader() {
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
