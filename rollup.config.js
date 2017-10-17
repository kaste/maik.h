import legacy from 'rollup-plugin-legacy';

export default {
  input: 'hyperhtml.js',
  output: {
    file: 'index.js',
    format: 'iife',
    name: 'hyperHTML',
  },
  plugins: [
      legacy({
        './node_modules/majinbuu/index.js': 'majinbuu',
      })
    ]
};
