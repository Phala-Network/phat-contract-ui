import { type OnChainRegistry } from '@phala/sdk'
import * as R from 'ramda'

export async function unsafeGetContractCodeHash(phatRegistry: OnChainRegistry, contractId: string): Promise<string | null> {
  const payload = await phatRegistry.phactory.getContractInfo({ contracts: [contractId] })
  const codeHash = R.path(['contracts', 0, 'codeHash'], payload)
  return codeHash || null
}

export async function unsafeGetAbiFromPatronByCodeHash(codeHash: string): Promise<Record<string, unknown>> {
  const codeHashWithoutPrefix = codeHash.indexOf('0x') === 0 ? codeHash.replace('0x', '') : codeHash
  const resp = await fetch(`https://api.patron.works/buildSessions/metadata/${codeHashWithoutPrefix}`)
  if (resp.status !== 200) {
    let payload
    try {
      payload = await resp.json()
    } catch (_err1) {
      try {
        const text = await resp.text()
        throw new Error(`Failed to get abi from Patron: ${resp.status}: ${text}`)
      } catch (_err2) {
        throw new Error(`Unknown Error: ${resp.status}: ${_err2}`)
      }
    }
    throw new Error(`Failed to get abi from Patron: ${resp.status}: ${R.propOr('Unknown Error', 'error', payload)}`)
  }
  return await resp.json()
}

export async function unsafeGetAbiFromGitHubRepoByCodeHash(codeHash: string): Promise<Record<string, unknown>> {
  const codeHashWithPrefix = codeHash.indexOf('0x') !== 0 ? `0x${codeHash}` : codeHash
  const resp = await fetch(`https://leechael.github.io/phat-contract-artifacts/artifacts/${codeHashWithPrefix}/metadata.json`)
  if (resp.status !== 200) {
    throw new Error(`Failed to get abi from GitHub: ${resp.status}`)
  }
  return await resp.json()
}

export async function unsafeGetWasmFromPatronByCodeHash(codeHash: string): Promise<Uint8Array> {
  const codeHashWithoutPrefix = codeHash.indexOf('0x') === 0 ? codeHash.replace('0x', '') : codeHash
  const resp = await fetch(`https://api.patron.works/buildSessions/wasm/${codeHashWithoutPrefix}`)
  if (resp.status !== 200) {
    throw new Error(`Failed to get abi from Patron: ${resp.status}`)
  }
  const buffer = await resp.arrayBuffer()
  return new Uint8Array(buffer)
}
