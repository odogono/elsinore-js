// Nodejs libs.
var path = require('path');

// External libs.
var Mocha = require('mocha');

module.exports = function(grunt){
    // setup
    grunt.initConfig({
        simplemocha: {
            options: {
              timeout: 3000,
              ignoreLeaks: false,
              grep:'poo',// '*-test',
              // ui: 'bdd',
              reporter: 'tap'
            },
            all: { 
                src:['test/**/*.js']
            }
        },
        jshint: {
            // define the files to lint
            files: ['gruntfile.js', 'lib/**/*.js', 'test/**/*.js'],
            // configure JSHint (documented at http://www.jshint.com/docs/)
            options: {
                // more options here if you want to override JSHint defaults
                globals: {
                    console: true,
                    module: true
                }
            }
        },
        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint']
        }
    });

    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask( 'test', ['simplemocha'] );
    grunt.registerTask( 'lint', ['jshint'] );
};