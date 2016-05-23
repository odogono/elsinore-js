var _ = require('underscore');
var Aliasify = require('aliasify');
var Babelify = require("babelify");
var Babel = require('gulp-babel');
var Browserify = require('browserify');
var Buffer = require('vinyl-buffer');
var Del = require('del');
var Envify = require('envify');
var Gulp = require('gulp');
var Jslint = require('gulp-jslint');
var Path = require('path');
var Source = require('vinyl-source-stream');
var Uglify = require('gulp-uglify');
var UnreachableBranchTransform = require('unreachable-branch-transform');
var Webserver = require('gulp-webserver');

var packageObj = require('./package.json');
var vendorDependencies = _.keys( packageObj.dependencies );

var UGLIFY_VENDOR_LIBS = false;
var UGLIFY_LIB = true;

var BabelOptions = {
    // presets: ['es2015'],
    presets: [ 'es2015-node' ],
};

var paths = {
    dist:{
        vendor: './dist/elsinore-vendor.js',
        lib: './dist/elsinore.js',
        test: './dist/elsinore-browser-tests.js'
    },
    test: './test/browser/index.js'
};

var pathExternals = paths.dist.vendor;

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

Gulp.task('build.bundle.vendor', function(){
    // console.log( vendorDependencies );
    var b = Browserify({
            noparse: vendorDependencies,
            debug: true
        })
    .on('error', handleErrors);

    b.transform( Babelify, BabelOptions );

    b.transform( Envify, {
        NODE_ENV: 'development'
    });

    b.transform( UnreachableBranchTransform );

    // backbone will include jquery if required
    b.exclude('jquery');

    b.require(vendorDependencies);

    b = b.bundle()
        .pipe(Source( Path.basename(pathExternals) ));

    if( UGLIFY_VENDOR_LIBS ){
        b = b.pipe(Buffer()).pipe(Uglify());
    }

    b.on('error', function (err) { console.log("Error : " + err.message); })
        .pipe(Gulp.dest( Path.dirname(pathExternals) ));
    return b;
});



Gulp.task('transpile', function () {
    return Gulp.src('src/**/*.js')
        .pipe(Babel(BabelOptions))
        .pipe(Gulp.dest('lib'));
});


Gulp.task('build.bundle.lib', function(cb){
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

    b.transform( Babelify, BabelOptions);

    b.transform( Envify, {
        NODE_ENV: 'development'
    });

    b.transform( UnreachableBranchTransform );
    

    b = b.bundle()
        .on('error', function(err){
            return cb('error in bundle: ' + err.message );
        })
        .pipe(Source( Path.basename(paths.dist.lib) ));
    if( UGLIFY_LIB ){
        b = b.pipe(Buffer()).pipe(Uglify());
    }
        //.pipe(Buffer()).pipe(Uglify())
    b = b.pipe(Gulp.dest( Path.dirname(paths.dist.lib) ))
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

    b.transform( Babelify, BabelOptions);

    // transform certain requires present in the tests
    // into something more browser friendly.
    // this is critical to allowing us to run the same
    // tests in both the browser and on the server
    b.transform( Aliasify, {
        aliases: {
            '../lib': 'elsinore',
            './common': './test/browser/common.js',
        },
        verbose: true
    });

    b.transform( Envify, {
        NODE_ENV: 'development'
    });

    b.transform( UnreachableBranchTransform );

    // browserify external doesn't currently appear to work with an array,
    // so we must manually apply each one
    vendorDependencies.forEach( function( lib ){
        b.external( lib );
    });

    // the main library has already been packaged, so it too is a dependency
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
    Gulp.src('.')
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

Gulp.task('build.bundle', ['build.bundle.vendor', 'build.bundle.lib', 'test.browser.build']);

Gulp.task('default', function(){
    // place code for your default task here
});