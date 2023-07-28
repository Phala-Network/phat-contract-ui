import { type OnChainRegistry, type PinkContractPromise, type CertificateData } from '@phala/sdk'
import { type Bool } from '@polkadot/types'
import * as R from 'ramda'

export interface CheckCodeHashExistsEnv {
  systemContract: PinkContractPromise
  cert: CertificateData
}

export function unsafeCheckCodeHashExists(env: CheckCodeHashExistsEnv) {
  const { systemContract, cert } = env
  return async function _unsafeCheckCodeHashExists(codeHash: string) {
    const { output } = await systemContract.query['system::codeExists']<Bool>(cert.address, { cert }, `0x${codeHash}`, 'Ink')
    return (output && output.isOk && output.asOk.isTrue)
  }
}

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

export async function unsafeGetWasmFromGithubRepoByCodeHash(codeHash: string): Promise<Uint8Array> {
  const codeHashWithPrefix = codeHash.indexOf('0x') !== 0 ? `0x${codeHash}` : codeHash
  const resp = await fetch(`${OFFICIAL_ARTIFACTS_URL}/artifacts/${codeHashWithPrefix}/out.wasm`)
  if (resp.status !== 200) {
    throw new Error(`Failed to get wasm from GitHub: ${resp.status}`)
  }
  const buffer = await resp.arrayBuffer()
  return new Uint8Array(buffer)
}
