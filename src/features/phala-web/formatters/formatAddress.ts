export default function trimAddress(str: string): string {
  if (str.length < 10) return str
  return `${str.slice(0, 6)}…${str.slice(-4)}`
}
