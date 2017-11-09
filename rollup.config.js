import rootImport from 'rollup-plugin-root-import'

export default {
  input: 'default-maik-bundle.js',
  output: {
    file: 'default-maik.js',
    format: 'iife',
    name: 'maik'
  },
  plugins: [rootImport()]
}
