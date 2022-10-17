import { Suspense } from 'react'
import tw from 'twin.macro'
import { atom, useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import { FormControl, FormLabel, Skeleton } from '@chakra-ui/react'

import { Select } from '@/features/ui/inputs/select'
import { availableClustersAtom, hasConnectedAtom } from '@/features/chain/atoms'
import { clusterIdAtom } from './atoms'

type ClusterInfo = {
  owner: string
  permission: string
  workers: string[]
}

const clusterOptionsAtom = atom(get => {
  const clusters = get(availableClustersAtom)
  return clusters.map(([id, obj]) => {
    const { permission } = obj as ClusterInfo
    return { label: `[${permission}] ${id.substring(0, 6)}...${id.substring(id.length - 6)}`, value: id }
  })
})

const RsyncSelect = () => {
  const [clusterId, setClusterId] = useAtom(clusterIdAtom)
  const options = useAtomValue(clusterOptionsAtom)
  return (
    <Select value={clusterId} onChange={setClusterId} options={options} />
  )
}

export default function ClusterIdField() {
  const hasConnected = useAtomValue(hasConnectedAtom)
  return (
    <FormControl>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">Cluster ID</FormLabel>
      <div tw="px-4 mt-4">
        <Suspense fallback={<Skeleton height="40px" />}>
          <RsyncSelect />
        </Suspense>
      </div>
    </FormControl>
  )
}