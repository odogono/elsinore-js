// taken from : https://github.com/greypants/gulp-starter/
var Exec = require('child_process').exec;
var Path = require('path');

var Browserify = require('browserify');
var Buffer = require('vinyl-buffer');
var Del = require('del');
var Gulp = require('gulp');
var Jslint = require('gulp-jslint');
var Source = require('vinyl-source-stream');
var Uglify = require('gulp-uglify');
var Webserver = require('gulp-webserver');

var packageObj = require('./package.json');
var vendorDependencies = Object.keys( packageObj.dependencies );


var paths = {
    dist:{
        vendor: './dist/vendor.js',
        lib: './dist/elsinore.js',
        test: './dist/browser-tests.js'
    },
    test: './test/browser/index.js'
};

var pathExternals = './dist/vendor.js';

var externals = vendorDependencies;

function handleErrors(err) {
    var args = Array.prototype.slice.call(arguments);

    // Send error to notification center with gulp-notify
    console.log('Compile Error : ' + JSON.stringify(args) );
    console.log( err.stack );
    // notify.onError({
    //     title: "Compile Error",
    //     message: "<%= error.message %>"
    // }).apply(this, args);

    // Keep gulp from hanging on this task
    this.emit('end');
};

Gulp.task('clean.vendor', function(){
    return Del( pathExternals );
});


Gulp.task('lint', function(){
    return Gulp.src('./lib/*.js')
        .pipe( Jslint({
            node: true,
            white: true,
            'continue': true,
            bitwise: true,
            plusplus: true,
            nomen: true
        })
        .on('error', function (error) {
            console.error(String(error));
        })
    );
});

Gulp.task('build.vendor', function(){
    // console.log( vendorDependencies );
    return Browserify({
            noparse: vendorDependencies,
            debug: true
        })
    .on('error', handleErrors)
    .require(vendorDependencies)
    .bundle()
    .pipe(Source( Path.basename(pathExternals) ))
    .pipe(Buffer()).pipe(Uglify())
    .pipe(Gulp.dest( Path.dirname(pathExternals) ));
});



Gulp.task('build.lib', function(cb){
    var b = Browserify({
            // entries:[ './lib/index.js' ],
            debug: false
        });
    b.require('./lib/index.js', {expose:'elsinore'});
    // browserify external doesn't currently appear to work with an array,
    // so we must manually apply each one
    vendorDependencies.forEach( function( lib ){
        b.external( lib );
    });

    b.bundle()
        .on('error', function(err){
            return cb('error in bundle: ' + err.message );
        })
        .pipe(Source( Path.basename(paths.dist.lib) ))
        // .pipe(Buffer()).pipe(Uglify())
        .pipe(Gulp.dest( Path.dirname(paths.dist.lib) ))
        .on('finish', function(){
            return cb();
        });
});


Gulp.task('test.browser.build', function(cb){
    console.log('build with ' + paths.test );
    var b = Browserify({
        entries: [ './test/browser/index.js' ],
        debug:true
        });

    // browserify external doesn't currently appear to work with an array,
    // so we must manually apply each one
    vendorDependencies.forEach( function( lib ){
        b.external( lib );
    });

    b.external( 'elsinore' );
    
    b.bundle()
        .on('error', function(err){
            return cb('error in bundle: ' + err.message );
        })
        .pipe(Source( Path.basename(paths.dist.test) ))
        // .pipe(Buffer()).pipe(Uglify())
        .pipe(Gulp.dest( Path.dirname(paths.dist.test) ))
        .on('finish', function(){
            return cb();
        });

});

Gulp.task('test.browser.server', function() {
    Gulp.src('dist')
        .pipe(Webserver({
            port:               8012,
            livereload:         {
                enable:         true,
                port:           35726
            },
            directoryListing:   false
         }));
 });


Gulp.task('test.browser.watch', function() {
  Gulp.watch( [ 'test/**/*.js', 'lib/**/*' ] , ['test.browser.build']);
});


Gulp.task('test.browser', [ 'test.browser.build', 'test.browser.server', 'test.browser.watch']);

Gulp.task('build', ['build.vendor', 'build.lib', 'test.browser.build']);

Gulp.task('default', function(){
    // place code for your default task here
});