import { memoizeWith } from 'ramda'

const formatter = new Intl.NumberFormat('en-US')

function formatPha(value: bigint, digits: number = 4): string {
  const computed = Number(value / BigInt(10 ** (12 - digits))) / (10 ** digits)
  return formatter.format(computed)
}

export default memoizeWith((value: bigint) => value.toString(), formatPha)

