import React, { useCallback } from 'react'
import tw from 'twin.macro'
import { FormControl, FormLabel, Button, Select, Checkbox, Box, Text, Code, Flex } from '@chakra-ui/react'
import { IoCloudUploadOutline, IoWarning, IoRefresh, IoArrowForward } from 'react-icons/io5'
import { useDropzone } from 'react-dropzone'
import { useAtom } from 'jotai'
import { useUpdateAtom, useAtomValue } from 'jotai/utils'

import {
  contractCandidateAtom,
  candidateFileInfoAtom,
  contractParserErrorAtom,
  // candidateAllowIndeterminismAtom,
  contractWASMInvalid,
} from "../atoms";

const HelpPanel = () => {
  const [error, setError] = useAtom(contractParserErrorAtom)
  const WASMInvalid = useAtomValue(contractWASMInvalid)

  const onRetry = () => {
    setError('')
  }

  return (
    <Flex
      position="absolute"
      top="0"
      left="0"
      w="full"
      h="full"
      bg="white"
      alignItems="center"
      justifyContent="center"
      color="black"
      display={error ? undefined : 'none'}
    >
      <Box pr={8} ml={-40}>
        <IoWarning size={72} />
      </Box>
      <Box>
        <Text fontSize="xl">Error</Text>
        <Text fontSize="sm">{error}</Text>
        <Flex gap={2} mt={4}>
          <Button colorScheme="phalaDark" rightIcon={<IoRefresh />} onClick={onRetry}>Retry</Button>
          {
            WASMInvalid ? (
              <Button
                as="a"
                href="https://wiki.phala.network/en-us/build/support/faq/#phat-ui-reports-an-error-before-deploying-the-contract"
                target="_blank"
                rel="noopener"
                colorScheme="phalaDark"
                variant="outline"
                rightIcon={<IoArrowForward />}
              >
                Go to see solution
              </Button>
            ) : null
          }
        </Flex>
      </Box>
    </Flex>
  )
}

interface DropzoneProps {
  isCheckWASM: boolean
}

const Dropzone = ({ isCheckWASM = true }: DropzoneProps) => {
  const setCandidate = useUpdateAtom(contractCandidateAtom)
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Do something with the files
    // @FIXME also the path / name should ends with `.contract`
    if (acceptedFiles.length > 0 && acceptedFiles[0]) {
      setCandidate({
        file: acceptedFiles[0],
        isCheckWASM,
      })
    }
  }, [setCandidate, isCheckWASM])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })
  return (
    <div tw="mt-1 relative">
      <div tw="flex justify-center px-6 pt-5 pb-6 rounded-sm">
        <Box
          {...getRootProps()}
          tw="w-full h-full p-6 border border-dashed border-gray-600 rounded-sm hover:cursor-pointer hover:bg-gray-600/50"
          bg={isDragActive ? 'gray.100' : ''}
        >
          <div tw="space-y-1 w-full">
            <IoCloudUploadOutline tw="h-8 w-8 text-phala-500 mx-auto mb-3" />
            <Text textAlign="center" fontSize={16} color="phala.500">
              Click or drag file to this area to upload
            </Text>
            <Text textAlign="center" fontSize={12} color="gray.100">
              {'The file name of Contract Bundle is ends with '}
              {
                isCheckWASM
                  ? <Code color="gray.200">.contract</Code>
                  : (
                    <>
                      <Code color="gray.200">.contract</Code>
                      or
                      <Code color="gray.200">.json</Code>
                    </>
                  )
              }
            </Text>
          </div>
        </Box>
      </div>
      <HelpPanel />
    </div>
  );
}

const CandidatePreview = () => {
  const [finfo, setFinfo] = useAtom(candidateFileInfoAtom)
  return (
    <div tw="px-4 flex justify-between items-center">
      <div>
        <p tw="text-sm text-gray-500">
          {finfo.name} ({Math.round(finfo.size / 1024)} kB)
        </p>
      </div>
      <Button
        tw="bg-black text-gray-300 border border-solid border-[#f3f3f3] hover:bg-[#f3f3f3] hover:text-black"
        h="1.75rem"
        mr="0.3rem"
        size="sm"
        onClick={() => setFinfo({ name: '', size: 0 })}
      >
        Change
      </Button>
    </div>
  )
}

type ContractFileUploadProps = DropzoneProps

const ContractFileUpload = ({ isCheckWASM } : ContractFileUploadProps) => {
  const finfo = useAtomValue(candidateFileInfoAtom)

  return (
    <FormControl>
      {finfo.size ? (
        <CandidatePreview />
      ) : (
        <Dropzone isCheckWASM={isCheckWASM} />
      )}
    </FormControl>
  )
}

export default ContractFileUpload