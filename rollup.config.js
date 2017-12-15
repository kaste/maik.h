import cdn from 'rollup-plugin-cdn'

export default {
  input: 'default-maik.js',
  output: {
    file: 'default-maik-bundle.js',
    format: 'iife',
    name: 'maik'
  },
  plugins: [cdn()]
}
