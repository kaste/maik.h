module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    files: ['test/**/*.js'],
    reporters: ['progress'],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadless'],
    autoWatch: true,
    singleRun: false, // Karma captures browsers, runs the tests and exits
    concurrency: Infinity,

    client: {
      mocha: {
        setup: 'tdd',
        // change Karma's debug.html to the mocha web reporter
        // reporter: 'html',

        // require specific files after Mocha is initialized
        // require: [require.resolve('bdd-lazy-var/bdd_lazy_var_global')],

        // custom ui, defined in required file above
        // ui: 'bdd-lazy-var/global',
      }
    }
  })
}