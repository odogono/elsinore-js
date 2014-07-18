// taken from : https://github.com/greypants/gulp-starter/

var Browserify = require('browserify');
var Gulp = require('gulp');
var Exec = require('child_process').exec;

// var gutil = require('gulp-util');
// var notify = require("gulp-notify");
var Source = require('vinyl-source-stream');
var Buffer = require('vinyl-buffer');
var Uglify = require('gulp-uglify');
var packageObj = require('./package.json');
var externals = Object.keys( packageObj.dependencies );

// console.log( externals );

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

Gulp.task('browserify-libs', function(){
    var b = Browserify();
    b.require( externals );

    return b.bundle()
        .on('error', handleErrors)
        .pipe(Source('libs.js'))
        // .pipe(Buffer())
        // .pipe(Uglify())
        .pipe(Gulp.dest('./dist/'));
});

Gulp.task('browserify', function(){
        return Browserify({
                entries: packageObj.files.map(function(path){ return './' + path }),
                extensions: ['.js'],
                bundleExternal: false,
            })
            .external( externals )
            .bundle({debug: true})
            .on('error', handleErrors)
            .pipe(Source('odgn-entity.js'))
            // .pipe(Buffer())
            // .pipe(Uglify())
            .pipe(Gulp.dest('./dist/'));
});

Gulp.task('test.run', function(){
    Exec('./bin/test test/test.entity_set.js', {}, function (error, stdout, stderr) {
        console.log('STDOUT');
        console.log(stdout);
        console.log('STDERR');
        console.log(stderr);
        // if (error) {
        //     console.log('-------ERROR-------');
        //     console.log(error);
        // }
    });
})

Gulp.task('watch', function() {
  Gulp.watch( [ 'test/**/*', 'lib/**/*' ] , ['test.run']);
});

Gulp.task('default', function(){
    // place code for your default task here
});