module.exports = {
  theme: {
    extend: {
      fontFamily: {
        serif: ['Raleway', 'ui-serif', 'sans-serif'],
        mono: [
          '"Berkeley Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
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
      }
    },
  },
}