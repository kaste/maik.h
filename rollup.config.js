import rootImport from 'rollup-plugin-root-import'

export default {
  input: 'hyperHTML.js',
  output: {
    file: 'index.js',
    format: 'iife',
    name: 'hyperHTML'
  },
  plugins: [rootImport()]
}
