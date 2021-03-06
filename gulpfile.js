var babelify = require('babelify');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var envify = require('envify/custom');
var exorcist = require('exorcist');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var prefix = require('gulp-autoprefixer');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');

require('babel-register');

var t_envify = ['envify', {
  'global': true,
  '_': 'purge',
  NODE_ENV: 'production'
}];

// 'plugins': ['undeclared-variables-check'],
var t_babelify = ['babelify', {
  'presets': ['es2015', 'react']
}];

gulp.task('js', function() {
  browserify({
    entries: ['js/App.jsx'],
    'transform': [t_babelify],
    debug: true
  })
    .bundle()
    .pipe(exorcist('s/dist/bundle.js.map'))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('s/dist'));
});

gulp.task('jsprod', function() {
  browserify({
    entries: ['js/App.jsx'],
    'transform': [t_babelify, t_envify],
    debug: true
  })
    .bundle()
    .pipe(exorcist('s/dist/bundle.min.js.map'))
    .pipe(source('bundle.min.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest('s/dist'));
});

gulp.task('css', function() {
  return gulp.src('./sass/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix('last 2 versions'))
    .pipe(sourcemaps.write('.')) // this is relative to gulp.dest()
    .pipe(gulp.dest('./s/dist/'));
});

gulp.task('tests', function() {
  return gulp.src('./js/tests/*.js')
    .pipe(mocha());
});

// gulp.task('css2', function() { // Do we need this?
//   return gulp.src('./sass/main2.scss')
//   .pipe(sourcemaps.init())
//   .pipe(sass().on('error', sass.logError))
//   .pipe(prefix('last 2 versions'))
//   .pipe(sourcemaps.write('.')) // this is relative to gulp.dest()
//   .pipe(gulp.dest('./s/dist/'));
// });

gulp.task('watch', function() {
  gulp.watch('js/**/*js*', ['js']);
  gulp.watch(['sass/*'], ['css']);
});

gulp.task('build_and_watch', ['css', 'js', 'watch']);
gulp.task('prod', ['css', 'jsprod']);
gulp.task('default', ['css', 'js']);

