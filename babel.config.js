module.exports = {
  presets: [
    // prepare babel
    '@babel/preset-env',
    // typescript translation
    '@babel/preset-typescript',
    // react translation
    [
      '@babel/preset-react',
      {
        // functions that JSX compiles to will be imported automatically
        runtime: 'automatic'
      },
    ],
  ],
  plugins: [
    // babel macros import translation
    'babel-plugin-macros',
  ],
}
