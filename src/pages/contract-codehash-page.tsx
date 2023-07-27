import React, { Suspense, useEffect, useMemo } from 'react'
import tw from 'twin.macro'
import { useMatch } from '@tanstack/react-location'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Box,
  Heading,
  Button,
} from '@chakra-ui/react'
import { Link } from '@tanstack/react-location'
import { BiChevronRight } from 'react-icons/bi'
import { Bool } from '@polkadot/types'
import { Atom, atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { isRight } from 'fp-ts/Either'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import * as R from 'ramda'

import { type PinkContractPromise, type CertificateData } from '@phala/sdk'
import { Alert } from '@/components/ErrorAlert'
import { aliceCertAtom, phatRegistryAtom } from '@/features/phat-contract/atoms'
import { unsafeGetAbiFromPatronByCodeHash } from '@/features/phat-contract/hosted-metadata'

//
//
//

// Brings from `unloadCodeCheckAtom` from `fat-contract-upload-form.tsx`

interface CheckCodeHashExistsEnv {
  systemContract: PinkContractPromise
  cert: CertificateData
}

function unsafeCheckCodeHashExists(env: CheckCodeHashExistsEnv) {
  const { systemContract, cert } = env
  return async function _unsafeCheckCodeHashExists(codeHash: string) {
    const { output } = await systemContract.query['system::codeExists']<Bool>(cert.address, { cert }, codeHash, 'Ink')
    return (output && output.isOk && output.asOk.isTrue)
  }
}

//
//
//

const codeHashAtom = atom('')

function codeHashLookupResultAtomWithCodeHash(inputAtom: Atom<string>) {
  const theAtom = atom(async get => {
    const codeHash = get(inputAtom)
    const registry = get(phatRegistryAtom)
    const cert = get(aliceCertAtom)

    const systemContract = registry.systemContract
    if (!systemContract) {
      // The chain environment is incomplete so this functional is fully unavailable.
      return O.none
    }
    const _unsafeCheckCodeHashExists = unsafeCheckCodeHashExists({ systemContract, cert })

    const [existent, patronAbi] = await Promise.all([
      TE.tryCatch(() => _unsafeCheckCodeHashExists(codeHash), R.always(null))(),
      TE.tryCatch(() => unsafeGetAbiFromPatronByCodeHash(codeHash), R.always(null))(),
    ])

    return O.some({
      codeHash,
      uploaded: isRight(existent) && existent.right,
      existsOnPatron: isRight(patronAbi),
      metadata: isRight(patronAbi) ? patronAbi.right : null,
    })
  })
  return theAtom
}

const codeHashLookupResultAtom = codeHashLookupResultAtomWithCodeHash(codeHashAtom)

//
//
//

function CodeHashLookupResult() {
  const lookupResult = useAtomValue(codeHashLookupResultAtom)
  if (O.isNone(lookupResult)) {
    return (
      <Alert status="error" title="Error">
        <p>The chain environment is incomplete so this functional is fully unavailable.</p>
      </Alert>
    )
  }
  const { uploaded, existsOnPatron, codeHash } = lookupResult.value
  if (!uploaded) {
    return (
      <Alert title="Hash Lookup failed in the Cluster">
        <div tw="flex flex-col gap-2">
          <p>The code may not yet uploaded to the cluster before.</p>
          {existsOnPatron ? (
            <>
              <p>We found it available on <a tw="underline" href={`https://patron.works/codeHash/${codeHash.substring(2)}`} target="_blank">Patron</a>. You can try upload and instantiate it from the verified build.</p>
              <div tw="mt-2">
                <Link to={`/contracts/add?codeHash=${codeHash}`}>
                  <Button colorScheme="phalaDark">
                    Instantiate Now
                  </Button>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </Alert>
    )
  }
  return (
    <div>
      Lookup
    </div>
  )
}


//
//
//

export default function ContractCodehashPage() {
  const { params: { codeHash } } = useMatch()
  const setCodeHash = useSetAtom(codeHashAtom)
  useEffect(() => {
    setCodeHash(codeHash)
  }, [codeHash, setCodeHash])
  return (
    <div>
      <Breadcrumb separator={<BiChevronRight color="gray.500" />} tw="mb-4">
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} href='/' to="/">Contracts</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      <Box tw="w-full">
        <Heading tw="mb-4 flex flex-row gap-6 items-end leading-none">
          <span>Hash Code</span>
          <code tw="text-xl relative -top-[3px]">{codeHash.substring(0, 8)}...{codeHash.substring(codeHash.length - 8 , codeHash.length)}</code>
        </Heading>
        <Suspense fallback={<div />}>
          <CodeHashLookupResult />
        </Suspense>
      </Box>
    </div>
  )
}
