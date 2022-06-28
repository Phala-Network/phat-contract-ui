import type { ComponentPropsWithoutRef, FC, ReactNode } from 'react'
import type { ComponentStyleConfig } from '@chakra-ui/theme'
import { Provider as JotaiProvider } from 'jotai'
import { queryClientAtom } from 'jotai/query'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactLocation, Router } from "@tanstack/react-location"

import '@fontsource/poppins/latin.css'
import '@fontsource/orbitron/latin.css'

export type FoundationProviderProps =
  { children: ReactNode}
  & ComponentPropsWithoutRef<typeof JotaiProvider>
  & Omit<ComponentPropsWithoutRef<typeof Router>, "location">;

const Input: ComponentStyleConfig = {
  // baseStyle: tw`text-sm font-mono bg-gray-200 outline-none`,
  baseStyle: {
    backgroundColor: 'gray.200',
  }
}

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
  },
  fonts: {
    heading: 'Orbitron, sans-serif',
    body: 'Poppins, sans-serif',
  },
  colors: {
    phalaDark: {
      DEFAULT: '#9DC431',
      '50': '#E2EFBE',
      '100': '#DAEBAE',
      '200': '#CCE28D',
      '300': '#BDDA6C',
      '400': '#AED24C',
      '500': '#9DC431',
      '600': '#799726',
      '700': '#556A1B',
      '800': '#313D0F',
      '900': '#0D1004'
    },
    phala: {
      DEFAULT: '#D1FF52',
      '50': '#FFFFFF',
      '100': '#FCFFF5',
      '200': '#F2FFCC',
      '300': '#E7FFA4',
      '400': '#DCFF7B',
      '500': '#D1FF52',
      '600': '#C2FF1A',
      '700': '#A5E100',
      '800': '#7CA900',
      '900': '#537100'
    }
  },
  components: {
    Input: {
      variants: {
        phala: {
          field: {
            fontSize: 'sm',
            backgroundColor: 'gray.200',
            color: 'black',
            border: '1px solid',
            borderColor: 'gray.300',
            borderRadius: 'sm',
            _focus: {
              borderColor: 'phalaDark.600',
            }
          }
        }
      },
      defaultProps: {
        variant: 'phala',
      },
    },
    Radio: {
      variants: {
        phala: {
          label: {
            color: 'black',
          },
        },
      },
      defaultProps: {
        colorScheme: "phalaDark",
        variant: 'phala',
      },
    },
    Form: {
      baseStyle: {
        container: {
          backgroundColor: '#f3f3f3',
        },
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: 'lg',
        fontWeight: '600',
        backgroundColor: 'black',
        color: 'phala.500',
        padding: '1rem',
        width: '100%',
      }
    },
    Switch: {
      baseStyle: {
        track: {
          bg: 'gray.200',
          border: '1px solid',
          borderColor: 'gray.300',
          _focus: {
            borderColor: 'gray.300',
            boxShadow: '0',
          }
        },
        thumb: {
          border: '1px solid',
          borderColor: 'gray.300',
        },
      },
      defaultProps: {
        colorScheme: 'phalaDark',
        size: 'lg',
      },
    },
  }
})

const location = new ReactLocation()

const queryClient = new QueryClient()

const FoundationProvider: FC<FoundationProviderProps> = ({
  children,
  // For Jotai Provider
  initialValues,
  scope,
  // For React-Location
  routes,
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider
        initialValues={[
          ...initialValues || [],
          [queryClientAtom, queryClient],
        ]}
        scope={scope}
      >
        <ChakraProvider theme={theme}>
          <Router
            routes={routes}
            location={location}
          >
            {children}
          </Router>
        </ChakraProvider>
      </JotaiProvider>
    </QueryClientProvider>
  )
}

export default FoundationProvider