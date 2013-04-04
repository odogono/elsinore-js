console.log('running Gruntfile');
module.exports = function(grunt){
    // setup
    grunt.initConfig({
        mochacli: {
            options: {
                reporter: 'nyan',
                bail: true
            },
            all: ['test/nodejs/*.js']
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

    grunt.loadNpmTasks('grunt-mocha-cli');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask( 'test', ['mochacli'] );
    grunt.registerTask( 'lint', ['jshint'] );
};