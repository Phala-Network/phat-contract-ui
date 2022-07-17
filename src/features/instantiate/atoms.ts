import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'

export const candidateAtom = atom<ContractMetadata | null>(null)

export const candidateFileInfoAtom = atomWithReset({ name: '', size: 0 })

export const contractParserErrorAtom = atom('')

export const contractAvailableSelectorAtom = atom(get => {
  const contract = get(candidateAtom)
  if (!contract) {
    return []
  }
  return [...contract.V3.spec.constructors.map(i => ({ value: i.selector, label: i.label, default: i.label === 'default' }))]
})

export const contractSelectedInitSelectorAtom = atom('')

export const contractSelectorOptionListAtom = atom(get => {
  const options = get(contractAvailableSelectorAtom)
  const selected = get(contractSelectedInitSelectorAtom)
  return options.map(i => ({
    value: i.value,
    label: i.label,
    selected: selected ? i.value === selected : i.default,
  }))
})

export const contractFinalInitSelectorAtom = atom(get => {
  const options = get(contractSelectorOptionListAtom)
  const found = options.filter(i => i.selected)
  if (found.length) {
    return found[0].value
  }
  return ''
})

export const contractCandidateAtom = atom('', (_, set, file: File) => {
  const reader = new FileReader()
  set(contractParserErrorAtom, '')
  reader.addEventListener('load', () => {
    try {
      const contract = JSON.parse(reader.result as string)
      if (!contract || !contract.source || !contract.source.hash || !contract.source.wasm) {
        set(contractParserErrorAtom, "Your contract file is invalid.")
        return
      }
      if (!contract.V3) {
        set(contractParserErrorAtom, "Your contract metadata version is too low, Please upgrade your cargo-contract with `cargo install cargo-contract --force`.")
        return
      }
      set(candidateFileInfoAtom, { name: file.name, size: file.size })
      set(candidateAtom, contract)
    } catch (e) {
      console.error(e)
      set(contractParserErrorAtom, `Your contract file is invalid: ${e}`)
    }
  })
  reader.readAsText(file, 'utf-8')
})

export const clusterIdAtom = atom('0x0000000000000000000000000000000000000000000000000000000000000000')
