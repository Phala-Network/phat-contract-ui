import React, { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { RESET } from 'jotai/utils'
import {
  candidateAtom,
  candidateFileInfoAtom,
  blueprintPromiseAtom,
  instantiatedContractIdAtom,
} from '../atoms'

export default function useReset() {
  const setCandidate = useSetAtom(candidateAtom)
  const setCandidateFileInfo = useSetAtom(candidateFileInfoAtom)
  const setBlueprintPromise = useSetAtom(blueprintPromiseAtom)
  const setInstantiatedContractId = useSetAtom(instantiatedContractIdAtom)
  const reset = useCallback(() => {
    setCandidate(null)
    setCandidateFileInfo(RESET)
    setBlueprintPromise(null)
    setInstantiatedContractId(null)
  }, [setCandidate, setBlueprintPromise, setInstantiatedContractId, setCandidateFileInfo])
  return reset
}
