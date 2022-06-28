import tw from 'twin.macro'
import { useAtom } from 'jotai'
import { FormControl, FormLabel, Input } from '@chakra-ui/react'

import { clusterIdAtom } from './atoms'

export default function ClusterIdField() {
  const [clusterId, setClusterId] = useAtom(clusterIdAtom)
  return (
    <FormControl>
      <FormLabel tw="bg-[#000] text-phala-500 p-4 w-full">Cluster ID</FormLabel>
      <div tw="px-4 mt-4">
        <Input
          css={tw`text-sm font-mono bg-gray-200 outline-none`}
          value={clusterId}
          onChange={(evt) => setClusterId(evt.target.value)}
        />
      </div>
    </FormControl>
  )
}