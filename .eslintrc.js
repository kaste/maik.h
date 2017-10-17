module.exports = {
    env: {
        es6: true,
        browser: true
    },
    extends: 'eslint:recommended',
    // parser: 'babel-eslint',
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module'
    },
    rules: {
        // indent: ['error', 2],
        // 'linebreak-style': ['error', 'unix'],
        'no-cond-assign': [1],
        'no-console': [0],
        'no-extra-semi': [1],
        'no-fallthrough': [1],
        'no-unused-vars': [
            'error',
            {
                varsIgnorePattern: '_',
                argsIgnorePattern: '(^_|^ev$)'
            }
        ],
        // quotes: ['error', 'single'],
        'semi': [1]
    }
}
