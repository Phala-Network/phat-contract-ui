import React from 'react'
import tw from 'twin.macro'
import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  ButtonGroup,
} from '@chakra-ui/react'
import { type FallbackProps } from 'react-error-boundary'
import ErrorStackParser from 'error-stack-parser'
import CopyToClipboard from 'react-copy-to-clipboard'


export function ErrorAlert({ error, resetErrorBoundary }: FallbackProps) {
  const lines = [`${error.message}`]
  ErrorStackParser.parse(error).forEach((frame) => {
    lines.push(`${frame.functionName} @ ${frame.fileName}:${frame.lineNumber}:${frame.columnNumber}`)
  })
  const formatted = lines.join('\n')
  return (
    <Alert status="error" borderRadius={4} flexDir="column" alignItems="start" gap={2}>
      <div tw="flex flex-row items-center">
        <AlertIcon />
        <AlertTitle>Oops, we hit a minor hitch!</AlertTitle>
      </div>
      <div tw="flex flex-col w-full pr-4">
        <AlertDescription>
          <p>
            An unexpected snag has cropped up. Your guidance can assist us greatly in resolving it - please
            do us the honor of reporting this on our <a href="https://discord.gg/2cvTKmF9uh" target="_blank" rel="noopener" tw="underline">Discord channel</a>.
            We deeply appreciate your help!
          </p>
          <details tw="my-2">
            <pre tw="text-sm font-mono p-2.5 bg-gray-900 overflow-scroll ml-4 mt-2">
              {formatted}
            </pre>
          </details>
          <ButtonGroup ml="4" mt="2">
            <CopyToClipboard text={formatted}>
              <Button size="sm">Copy Debug Info</Button>
            </CopyToClipboard>
            <Button size="sm" onClick={resetErrorBoundary}>Retry</Button>
          </ButtonGroup>
        </AlertDescription>
      </div>
    </Alert>
  )
}

