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
var UGLIFY_LIB = false;

const BabelOptions = {
    // presets: ['es2015'],
    // presets: [ 'es2015-node' ],
    presets: [ 
        'es2015', 
        'flow' 
    ]
};

const paths = {
    dist:{
        vendor: './dist/elsinore-vendor.js',
        lib: './dist/elsinore.js',
        test: './dist/elsinore-browser-tests.js'
    },
    test: './test/browser/index.js'
};

const pathExternals = paths.dist.vendor;

const externals = vendorDependencies;

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
        .on('error', error => console.error(String(error)))
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

    b.on('error', err => console.log("Error : " + err.message) )
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

    b.require('./src/browser.js', {expose:'elsinore'});
    // browserify external doesn't currently appear to work with an array,
    // so we must manually apply each one
    vendorDependencies.forEach( lib => b.external(lib) );

    b.transform( Babelify );

    b.transform( Envify, {
        NODE_ENV: 'development',
        // '_': 'purge',
        // NODE_ENV: 'production',
        // PLATFORM_ENV: 'browser'
    });

    b.transform( UnreachableBranchTransform );
    b = b.bundle()
        .on('error', err => cb('error in bundle: ' + err.message ))
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


Gulp.task('build.bundle.browser', function(cb){
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
    b.transform( Envify, {
        NODE_ENV: 'development'
    });

    b.transform( Aliasify, {
        aliases: {
            '../lib': 'elsinore',
            './common': './test/browser/common.js',
        },
        verbose: true
    });

    

    b.transform( UnreachableBranchTransform );

    // browserify external doesn't currently appear to work with an array,
    // so we must manually apply each one
    vendorDependencies.forEach( lib => b.external(lib) );

    // the main library has already been packaged, so it too is a dependency
    b.external( 'elsinore' );
    
    b.bundle()
        .on('error', err => {
            console.log('error in bundle!', err.stack)
            return cb('error in bundle: ' + err.message)
        })
        .pipe(Source( Path.basename(paths.dist.test) ))
        // .pipe(Buffer()).pipe(Uglify())
        .pipe(Gulp.dest( Path.dirname(paths.dist.test) ))
        .on('error', err => cb('error in bundle: ' + err.message))
        .on('finish', () => cb());

});

Gulp.task('test.browser.server', () => {
    Gulp.src('.')
        .pipe(Webserver({
            port:               8012,
            livereload:         {
                enable:         true,
                port:           35726
            },
            directoryListing:   true,
            // open: 'test.html'
         }));
 });


Gulp.task('test.browser.watch', () => {
  Gulp.watch( [ 'test/**/*.js', 'src/**/*' ] , ['build.bundle.browser']);
});


Gulp.task('test.browser', [ 'build.bundle.lib', 'build.bundle.browser', 'test.browser.server', 'test.browser.watch']);

Gulp.task('build.bundle', ['build.bundle.vendor', 'transpile', 'build.bundle.lib', 'build.bundle.browser']);

Gulp.task('default', function(){
    // place code for your default task here
});