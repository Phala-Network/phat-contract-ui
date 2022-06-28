import type { ApiPromise } from '@polkadot/api'
import type { StorageKey } from '@polkadot/types'
import type { Codec, AnyJson, AnyTuple } from '@polkadot/types-codec/types'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'

import * as R from 'ramda'
import { web3FromSource } from '@polkadot/extension-dapp'

import { create, createPruntimeApi, signCertificate, types as phalaSDKTypes } from '../../sdk'

function toHuman(value: Codec): AnyJson {
  return value.toHuman()
}

export async function contracts(api: ApiPromise, contractId?: string) {
  const result = await api.query.phalaFatContracts.contracts.entries()
  return R.fromPairs(R.map(R.map(toHuman), result) as [string, AnyJson][])
}
