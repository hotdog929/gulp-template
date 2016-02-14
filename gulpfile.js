var gulp = require('gulp-param')(require('gulp'), process.argv);
var rename = require("gulp-rename");

var fs = require('fs');
var es = require('event-stream');
var del = require('del');
var path = require('path');
var Q = require('q');
var _ = require('underscore');

var util = require('gulp-template-util');

var browserify = require('browserify');
var jsonnetExec = require('jsonnet-exec');

var gulpTemplateDir = 'gulp_template';
var nodeModulesDir = 'node_modules';
var webappDir = 'src/main/webapp';
var webLibDir = webappDir + '/lib';
var webResourceDir = webappDir + '/resource';
var viewsDir = webappDir + '/WEB-INF/view';
var scriptDir = webappDir + '/coffee';
var cssDir = webappDir + '/less';
var jsonI18nDir = webappDir + '/i18n';
var i18nDir = 'src/main/i18n';
var javaI18nDir = 'src/main/resources/i18n';
var versionFile = 'src/main/resources/version.properties';
var cdnFile = 'src/main/resources/cdn.properties';

var javaI18nFileName = 'messages_#{file}.properties';
var javaI18nFileNameRegex = /#{file}/g;

var jsWebI18n = 'jsWebI18n';

var versionRegex = /^version=(\S+)/m;
var version = fs.readFileSync(versionFile, 'utf8').toString().match(versionRegex)[1];

var cdnRegex = /^cdn=(.*)$/m;
var cdn = fs.readFileSync(cdnFile, 'utf8').toString().match(cdnRegex)[1];

var distDir = webappDir + '/dist/' + version;
var distJs = distDir + '/js';
var distCss = distDir + '/css';
var distI18n = distDir + '/i18n';




function addModuleTask(module, template){
    if(!template){
        template = 'default';
    }
    module = module.trim();
    var layerNum = util.countPathLayer(module);
    var scriptStream = gulp.src(util.dirPath(gulpTemplateDir) + template + '/script.coffee')
        .pipe(rename(module + '.coffee'))
        .pipe(util.replaceEnv(layerNum))
        .pipe(gulp.dest(util.dirPath(scriptDir)));
    var cssStream = gulp.src(util.dirPath(gulpTemplateDir) + template + '/css.less')
        .pipe(rename(module + '.less'))
        .pipe(util.replaceEnv(layerNum))
        .pipe(gulp.dest(util.dirPath(cssDir)));
    return util.streamsPromise(scriptStream, cssStream);
}

gulp.task('addModule', addModuleTask);


function addViewTask(view, template){
    if(!template){
        template = 'default';
    }
    view = view.trim();
    var layerNum = util.countPathLayer(view);
    var viewStream = gulp.src(util.dirPath(gulpTemplateDir) + template + '/html.html')
        .pipe(rename(view + '.html'))
        .pipe(util.replaceEnv(layerNum))
        .pipe(gulp.dest(util.dirPath(viewsDir)));
    return Q.all([util.streamsPromise(viewStream), addModuleTask(view)]);
}

gulp.task('addView', addViewTask);


function delModuleTask(module){
    module = util.filePath(module.trim());
    return del([
        util.dirPath(scriptDir) + module + '.coffee',
        util.dirPath(cssDir) + module + '.less'
    ]);
}

gulp.task('delModule', delModuleTask);


function delViewTask(view){
    view = util.filePath(view.trim());
    return Q.all([del([util.dirPath(viewsDir) + view + '.html']), delModuleTask(view)]);
}

gulp.task('delView', delViewTask);


function buildTask(){
    var deferred = Q.defer();
    Q.fcall(cleanTask)
        .then(function(){return util.streamsPromise(copyWebLibTask(), copyWebResourceTask())})
        .then(function(){return Q.all([i18nAllTask(), scriptEnvTask(), cssEnvTask()])})
        .then(function(){return util.streamsPromise(scriptAllTask(), cssAllTask())})
        .then(function(){deferred.resolve();});
    return deferred.promise;
}

gulp.task('build', buildTask);


function cleanTask(){
    return del([
        distDir,
        jsonI18nDir,
        javaI18nDir
    ]);
}

gulp.task('clean', cleanTask);


gulp.task('watch', function(view, modules){
    scriptModules = (!modules) ? [] : util.splitPaths(modules);
    scriptModules.push(view);
    var scriptPaths = _.map(scriptModules, function(name){return util.dirPath(scriptDir) + '**/'+name+'.coffee'});
    gulp.watch(scriptPaths, function(event){
        util.logStream(scriptTask, [util.dirPath(scriptDir) + '**/'+view+'.coffee']);
    });

    cssModules = (!modules) ? [] : util.splitPaths(modules);
    cssModules.push(view);
    var cssPaths = _.map(cssModules, function(name){return util.dirPath(cssDir) + '**/'+name+'.less'});
    gulp.watch(cssPaths, function(event){
        util.logStream(cssTask, [util.dirPath(cssDir) + '**/'+view+'.less']);
    });

    gulp.watch(util.dirPath(i18nDir) + "**/*.jsonnet", function(event){
        util.logPromise(i18nTask, [event.path]);
    });
});


function copyWebLibTask(){
    var packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8').toString());
    if(!packageJson.dependencies){
        packageJson.dependencies = {};
    }
    var webLibModules = [];
    for(var module in packageJson.dependencies){
        webLibModules.push(util.dirPath(nodeModulesDir) + module + '/**/*');
    }
    return gulp.src(webLibModules, {base : util.dirPath(nodeModulesDir)})
        .pipe(gulp.dest(util.dirPath(distDir)))
        .pipe(gulp.dest(util.dirPath(webLibDir)));
}

gulp.task('copyWebLib', copyWebLibTask);


function copyWebResourceTask(){
    return gulp.src(util.dirPath(webResourceDir) + "**/*", {base : util.dirPath(webResourceDir)})
        .pipe(gulp.dest(util.dirPath(distDir)));
}

gulp.task('copyWebResource', copyWebResourceTask);


function jsonToProperties(json, prefix){
    var str = '';
    for(var p in json){
        if(typeof json[p] === 'object' && json[p] !== null){
            if(Array.isArray(json[p])){
                var arr = json[p];
                for(var i=0 ; i<arr.length ; i++){
                    if(typeof arr[i] === 'object' && arr[i] !== null){
                        str += jsonToProperties(arr[i], prefix+p+'.'+i+'.');
                    }else{
                        str += prefix+p+'.'+i+'='+arr[i]+"\n";
                    }
                }
            }else{
                str += jsonToProperties(json[p], prefix+p+'.');
            }
        }else{
            str += prefix+p+'='+json[p]+"\n";
        }
    }
    return str;
}

function buildJavaI18n(){
    return es.map(function(file, cb){
        var i18nJson = JSON.parse(file.contents.toString());
        var resutl = jsonToProperties(i18nJson, '');
        file.contents = new Buffer(resutl);
        var fileName = path.basename(file.path, '.jsonnet');
        file.path = path.join(file.base, javaI18nFileName.replace(javaI18nFileNameRegex, fileName));
        cb(null, file);
    });
}

function buildJsI18n(){
    return es.map(function(file, cb){
        var i18nJson = JSON.parse(file.contents.toString());
        file.contents = new Buffer(jsWebI18n + ' = ' + JSON.stringify(i18nJson)+";");
        cb(null, file);
    });
}

function buildI18n(){
    return es.map(function(file, cb){
        var result = jsonnetExec.execSync(file.path);
        file.contents = new Buffer(result);
        cb(null, file);
    });
}

function i18nTask(paths){
    var javaI18nStream = gulp.src(util.splitPaths(paths))
        .pipe(buildI18n())
        .pipe(buildJavaI18n())
        .pipe(rename({extname:'.properties'}))
        .pipe(gulp.dest(util.dirPath(javaI18nDir)));
    var jsI18nStream = gulp.src(util.splitPaths(paths))
        .pipe(buildI18n())
        .pipe(buildJsI18n())
        .pipe(rename({extname:'.js'}))
        .pipe(gulp.dest(util.dirPath(distI18n)));
    return util.streamsPromise(javaI18nStream, jsI18nStream);
}

gulp.task('i18n', i18nTask);

function i18nAllTask(){
    return i18nTask(util.dirPath(i18nDir) + "**/*.jsonnet");
}

gulp.task("i18nAll", i18nAllTask);



function scriptEnvTask(){
    return Q.nfcall(
        fs.writeFile,
        util.dirPath(scriptDir) + '_env.coffee',
        'module.exports = {version:"' + version + '",cdn:"' + util.dirPath(cdn) + version + '"};');
}

gulp.task('scriptEnv', scriptEnvTask);

var coffeeify = require('coffeeify');

function buildScript(){
    return es.map(function(file, cb){
        var bundle = browserify({extensions : ['.coffee']});
        bundle.transform(coffeeify, {bare : false, header : true});
        bundle.add(file.path);
        bundle.bundle(function(error, result){
            if(error != null){
                console.log(error);
                throw error;
            }
            file.contents = new Buffer(result);
            cb(null, file);
        });
    });
}

function scriptTask(paths){
    return gulp.src(util.splitPaths(paths))
        .pipe(buildScript())
        .pipe(rename({extname:'.js'}))
        .pipe(gulp.dest(util.dirPath(distJs)));
}

gulp.task('script', ['scriptEnv'], scriptTask);

function scriptAllTask(){
    return scriptTask(util.dirPath(scriptDir) + "**/*.coffee");
}

gulp.task('scriptAll', ['scriptEnv'], scriptAllTask);



function cssEnvTask(){
    return Q.nfcall(
        fs.writeFile,
        util.dirPath(cssDir) + '_env.less',
        '@version:"' + version + '";@cdn:"' + util.dirPath(cdn) + version + '";');
}

gulp.task('cssEnv', cssEnvTask);

var less = require('less');

function buildCss(){
    return es.map(function(file, cb){
        less.render(
            file.contents.toString(), {
                paths : [],
                filename : file.path,
                compress : false
            },
            function(error, result){
                if(error != null){
                    console.log(error);
                    throw error;
                }
                file.contents = new Buffer(result.css);
                cb(null, file);
            }
        );
    });
}

function cssTask(paths){
    return gulp.src(util.splitPaths(paths))
        .pipe(buildCss())
        .pipe(rename({extname:'.css'}))
        .pipe(gulp.dest(util.dirPath(distCss)));
}

gulp.task('css', ['cssEnv'], cssTask);

function cssAllTask(){
    return cssTask(util.dirPath(cssDir) + "**/*.less");
}

gulp.task('cssAll', ['cssEnv'], cssAllTask);
