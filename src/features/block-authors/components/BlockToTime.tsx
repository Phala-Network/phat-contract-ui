import React from 'react'
import { useBlockTime } from '../hooks/useBlockTime';

const BlockToTime = () => {
  const [, text] = useBlockTime();

  return (
    <>
      {
        (text as string).split(' ').map((value, index) =>
          <span
            key={index}
          >{value}</span>
        )
      }
    </>
  )
}

export default BlockToTime