import { atom } from 'jotai'
import { atomWithStorage, RESET } from 'jotai/utils'

export function getEnv(expected: string | undefined, fallback: string) {
  if (process.env.NODE_ENV !== 'production' && expected) {
    return expected
  }
  return fallback
}

export const PARACHAIN_ENDPOINT = 'wss://poc6.phala.network/ws'

export const preferedEndpointAtom = atomWithStorage<string>('last-selected-rpc', PARACHAIN_ENDPOINT)

type ISwitchMode = "switch" | "input";

export const switchModeAtom = atomWithStorage<ISwitchMode>('last-switch-mode', "switch")

export const endpointAtom = atom(
  get => get(preferedEndpointAtom),
  (get, set, next: string | typeof RESET) => {
    if (next === RESET) {
      set(preferedEndpointAtom, `${PARACHAIN_ENDPOINT}`)
    } else {
      set(preferedEndpointAtom, next)
    }
  }
)
