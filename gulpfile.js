var fs = require('fs');
var path = require('path');

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')(); // Load all gulp plugins
                                              // automatically and attach
                                              // them to the `plugins` object

var runSequence = require('run-sequence');    // Temporary solution until gulp 4
                                              // https://github.com/gulpjs/gulp/issues/355

//adding node modules so we can use them.
var sass    = require("gulp-sass"),
    concat    = require("gulp-concat"),
    watch     = require("gulp-watch"),
    plumber   = require("gulp-plumber"),
    minify_css  = require("gulp-minify-css"),
    uglify    = require("gulp-uglify"),
    sourcemaps  = require("gulp-sourcemaps"),
    imagemin    = require("gulp-imagemin"),
    notify    = require("gulp-notify"),
    pngquant  = require("imagemin-pngquant"),
    prefix    = require("gulp-autoprefixer");
    streamqueue     = require("streamqueue");

var pkg = require('./package.json');
var dirs = pkg['h5bp-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------

gulp.task('archive:create_archive_dir', function () {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', function (done) {

    var archiveName = path.resolve(dirs.archive, pkg.name + '_v' + pkg.version + '.zip');
    var archiver = require('archiver')('zip');
    var files = require('glob').sync('**/*.*', {
        'cwd': dirs.dist,
        'dot': true // include hidden files
    });
    var output = fs.createWriteStream(archiveName);

    archiver.on('error', function (error) {
        done();
        throw error;
    });

    output.on('close', done);

    files.forEach(function (file) {

        var filePath = path.resolve(dirs.dist, file);

        // `archiver.bulk` does not maintain the file
        // permissions, so we need to add files individually
        archiver.append(fs.createReadStream(filePath), {
            'name': file,
            'mode': fs.statSync(filePath)
        });

    });

    archiver.pipe(output);
    archiver.finalize();

});

gulp.task('clean', function (done) {
    require('del')([
        dirs.archive,
        dirs.dist
    ], done);
});

gulp.task('copy', [
    'copy:.htaccess',
    'copy:index.html',
    'copy:jquery',
    'copy:license',
    'copy:main.css',
    'copy:misc',
    'copy:normalize'
]);

gulp.task('copy:.htaccess', function () {
    return gulp.src('node_modules/apache-server-configs/dist/.htaccess')
               .pipe(plugins.replace(/# ErrorDocument/g, 'ErrorDocument'))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:index.html', function () {
    return gulp.src(dirs.src + '/index.html')
               .pipe(plugins.replace(/{{JQUERY_VERSION}}/g, pkg.devDependencies.jquery))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:jquery', function () {
    return gulp.src(['node_modules/jquery/dist/jquery.min.js'])
               .pipe(plugins.rename('jquery-' + pkg.devDependencies.jquery + '.min.js'))
               .pipe(gulp.dest(dirs.dist + '/js/vendor'));
});

gulp.task('copy:license', function () {
    return gulp.src('LICENSE.txt')
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:main.css', function () {

    var banner = '/*! HTML5 Boilerplate v' + pkg.version +
                    ' | ' + pkg.license.type + ' License' +
                    ' | ' + pkg.homepage + ' */\n\n';

    return gulp.src(dirs.src + '/css/main.css')
               .pipe(plugins.header(banner))
               .pipe(plugins.autoprefixer({
                    browsers: ['last 2 versions', 'ie >= 8', '> 1%'],
                    cascade: false
               }))
               .pipe(gulp.dest(dirs.dist + '/css'));
});

gulp.task('copy:misc', function () {
    return gulp.src([

        // Copy all files
        dirs.src + '/**/*',

        // Exclude the following files
        // (other tasks will handle the copying of these files)
        '!' + dirs.src + '/css/main.css',
        '!' + dirs.src + '/index.html'

    ], {

        // Include hidden files by default
        dot: true

    }).pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:normalize', function () {
    return gulp.src('node_modules/normalize.css/normalize.css')
               .pipe(gulp.dest(dirs.dist + '/css'));
});

gulp.task('lint:js', function () {
    return gulp.src([
        'gulpfile.js',
        dirs.src + '/js/*.js',
        dirs.test + '/*.js'
    ]).pipe(plugins.jscs())
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('jshint-stylish'))
      .pipe(plugins.jshint.reporter('fail'));
});


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('archive', function (done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
    done);
});

gulp.task('build', function (done) {
    runSequence(
        ['clean', 'lint:js'],
        'copy',
    done);
});

gulp.task('default', ['build']);

// ---------------------------------------------------------------------
// | Extended tasks -JD 3/28/15                                                        |
// ---------------------------------------------------------------------

var dest_js ="src/js";
var dest_css = "src/css";
var dest_img = "src/img";

var src_sass = "dist/sass/**/*.scss";
var src_js = "dist/js/**/*.js";
var src_img = "dist/img/*";

//-------------------------------------------------------

var onError = function(err){
  console.log(err);
  this.emit('end');
}

//SASS to CSS
gulp.task('sass', function(){

    return streamqueue({ objectMode: true },
        gulp.src(['dist/sass/normalize.scss', 'dist/sass/main.scss']),
        gulp.src(['dist/sass/style.scss']).pipe(sass())
        )
    .pipe(plumber({
      errorHandler:onError
    }))
    .pipe(prefix('last 2 versions'))
    .pipe(concat('app.min.css'))
    .pipe(gulp.dest(dest_css))
    .pipe(minify_css())   
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(dest_css))
    //.pipe(notify({message: 'Hello world we are done'}))
});

//-------------------------------------------------------

//Compile JS

gulp.task('js', function(){
  return gulp.src(src_js)
    .pipe(plumber())
    .pipe(uglify())
    .pipe(concat('app.min.js'))
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(dest_js))
})

//-------------------------------------------------------

//Images

gulp.task('img', function(){
  return gulp.src(src_img)
    .pipe(imagemin({
      progressive:true,
      svgoPlugins: [{removeViewBox: false}],
      use: [pngquant()]
    }))
    .pipe(gulp.dest(dest_img))

})


//-------------------------------------------------------

//Watch

gulp.task('watch', function(){
  gulp.watch(src_js, ['js']);
  gulp.watch(src_sass, ['sass']);
  gulp.watch(src_img, ['img']);
})
