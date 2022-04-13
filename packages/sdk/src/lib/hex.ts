import {randomBytes} from 'browser-crypto'

export const randomHex = (size = 12): string =>
  randomBytes(size).toString('hex')
