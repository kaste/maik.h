import cdn from 'rollup-plugin-cdn'

export default {
  input: 'default-maik-bundle.js',
  output: {
    file: 'default-maik.js',
    format: 'iife',
    name: 'maik'
  },
  plugins: [cdn()]
}
