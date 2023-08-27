import type { ComponentPropsWithoutRef, FC, ReactNode } from 'react'
import type { ComponentStyleConfig } from '@chakra-ui/theme'
import { Provider as JotaiProvider } from 'jotai'
import { queryClientAtom } from 'jotai/query'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactLocation, Router } from "@tanstack/react-location"

import '@fontsource/montserrat/latin.css'
import '@fontsource/roboto-mono/latin.css'
import '@fontsource/poppins/latin.css'

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
    heading: 'Montserrat, sans-serif',
    body: 'Poppins, sans-serif',
  },
  colors: {
    brand: {
      DEFAULT: '#6FB74E',
      '100': '#E7F3E2',
      '200': '#ADD69A',
      '300': '#6FB74E',
      '400': '#5F9F41',
      '500': '#56913B',
      '600': '#45742F',
      '700': '#345723',
      '800': '#2B481E',
      '900': '#233A18'
    },
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
    },
    // New Design System
    phatGreen: {
      50: '#F5FFF0',
      100: '#D5F6C6',
      200: '#B2E69A',
      300: '#8AD368',
      400: '#6FB74E',
      500: '#59A138',
      600: '#438525',
      700: '#3B6727',
      800: '#325422',
      900: '#29451C',
    },
    phalaGreen: {
      50: '#FAFEED',
      100: '#F5FEDC',
      200: '#EBFDB9',
      300: '#E1FC96',
      400: '#D7FB73',
      500: '#CDFA50',
      600: '#A4C840',
      700: '#7B9630',
      800: '#526420',
      900: '#293210',
    },
    phalaPurple: {
      50: '#F2EDFE',
      100: '#E5DCFE',
      200: '#CCBAFD',
      300: '#B297FC',
      400: '#9975FB',
      500: '#7F52FA',
      600: '#6642C8',
      700: '#4C3196',
      800: '#332164',
      900: '#191032',
    },
    phalaWorldTeal: {
      50: '#D7FEF7',
      100: '#AFFDEF',
      200: '#86FCE7',
      300: '#5EFBDF',
      400: '#36FAD7',
      500: '#2DD2B5',
      600: '#25AA92',
      700: '#1C8270',
      800: '#135A4D',
      900: '#0B322B',
    },
  },
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
        <ChakraProvider
          theme={theme}
          toastOptions={{
            defaultOptions: {
              position: 'top',
              colorScheme: 'phatGreen',
            }
          }}
        >
          <Router
            routes={routes}
            location={location}
          >
            {children}
          </Router>
          <ReactQueryDevtools />
        </ChakraProvider>
      </JotaiProvider>
    </QueryClientProvider>
  )
}

export default FoundationProvider