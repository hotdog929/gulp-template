var gulp = require('gulp-param')(require('gulp'), process.argv);
var rename = require("gulp-rename");

var fs = require('fs');
var es = require('event-stream');
var del = require('del');
var path = require('path');
var Q = require('q');
var _ = require('underscore');

var browserify = require('browserify');
var jsonnetExec = require('jsonnet-exec');

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


function dirPath(path){
    var result = path.trim();
    if(result.length == 0){
        return "/";
    }else{
        return (result[result.length - 1] == "/") ? result : result + "/";
    }
}

function splitPaths(paths){
    var pathList = paths.split(',');
    var list = [];
    for(var i=0 ; i<pathList.length ; i++){
        list.push(pathList[i].trim());
    }
    return list;
}

function streamsPromise(){
    var streams = arguments;
    var deferred = Q.defer();
    var endNum = 0;
    var onStreamEnd = function(){
        endNum++;
        if(endNum == streams.length){
            deferred.resolve();
        }
    };
    var onStreamError = function(){
        deferred.reject();
    };
    for(var i=0 ; i<streams.length ; i++){
        streams[i]
            .on('end', onStreamEnd)
            .on('error', onStreamError)
    }
    return deferred.promise;
}

function streamsFnPromise(){
    var fns = arguments;
    var streams = [];
    for(var i=0 ; i<fns.length ; i++){
        streams.push(fns[i]());
    }
    return streamsPromise.apply(this, streams);
}

function logStream(fn, args){
    var deferred = Q.defer();
    var startTime = new Date().getTime();
    console.log("Starting '" + fn.name + "'");
    fn.apply(this, args).on('end', function(){
            deferred.resolve();
            console.log("Finished '" + fn.name + "' after " + (new Date().getTime() - startTime) + 'ms');})
        .on('error', function(error){
            deferred.reject();
            console.log("'" + fn.name + "' errored after " + (new Date().getTime() - startTime) + 'ms');});
    return deferred.promise;
}

function logPromise(fn, args){
    var deferred = Q.defer();
    var startTime = new Date().getTime();
    console.log("Starting '" + fn.name + "'");
    fn.apply(this, args).then(function(){
            deferred.resolve();
            console.log("Finished '" + fn.name + "' after " + (new Date().getTime() - startTime) + 'ms');})
        .catch(function(error){
            deferred.reject();
            console.log("'" + fn.name + "' errored after " + (new Date().getTime() - startTime) + 'ms');});
    return deferred.promise;
}


function buildTask(){
    var deferred = Q.defer();
    Q.fcall(cleanTask)
        .then(function(){return streamsPromise(copyWebLibTask(), copyWebResourceTask())})
        .then(function(){return Q.all([i18nAllTask(), scriptEnvTask(), cssEnvTask()])})
        .then(function(){return streamsPromise(scriptAllTask(), cssAllTask())})
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
    scriptModules = (!modules) ? [] : splitPaths(modules);
    scriptModules.push(view);
    var scriptPaths = _.map(scriptModules, function(name){return dirPath(scriptDir) + '**/'+name+'.coffee'});
    gulp.watch(scriptPaths, function(event){
        logStream(scriptTask, [dirPath(scriptDir) + '**/'+view+'.coffee']);
    });

    cssModules = (!modules) ? [] : splitPaths(modules);
    cssModules.push(view);
    var cssPaths = _.map(cssModules, function(name){return dirPath(cssDir) + '**/'+name+'.less'});
    gulp.watch(cssPaths, function(event){
        logStream(cssTask, [dirPath(cssDir) + '**/'+view+'.less']);
    });

    gulp.watch(dirPath(i18nDir) + "**/*.jsonnet", function(event){
        logPromise(i18nTask, [event.path]);
    });
});


function copyWebLibTask(){
    var packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8').toString());
    if(!packageJson.dependencies){
        packageJson.dependencies = {};
    }
    var webLibModules = [];
    for(var module in packageJson.dependencies){
        webLibModules.push(dirPath(nodeModulesDir) + module + '/**/*');
    }
    return gulp.src(webLibModules, {base : dirPath(nodeModulesDir)})
        .pipe(gulp.dest(dirPath(distDir)))
        .pipe(gulp.dest(dirPath(webLibDir)));
}

gulp.task('copyWebLib', copyWebLibTask);


function copyWebResourceTask(){
    return gulp.src(dirPath(webResourceDir) + "**/*", {base : dirPath(webResourceDir)})
        .pipe(gulp.dest(dirPath(distDir)));
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
    var javaI18nStream = gulp.src(splitPaths(paths))
        .pipe(buildI18n())
        .pipe(buildJavaI18n())
        .pipe(rename({extname:'.properties'}))
        .pipe(gulp.dest(dirPath(javaI18nDir)));
    var jsI18nStream = gulp.src(splitPaths(paths))
        .pipe(buildI18n())
        .pipe(buildJsI18n())
        .pipe(rename({extname:'.js'}))
        .pipe(gulp.dest(dirPath(distI18n)));
    return streamsPromise(javaI18nStream, jsI18nStream)
}

gulp.task('i18n', i18nTask);

function i18nAllTask(){
    return i18nTask(dirPath(i18nDir) + "**/*.jsonnet");
}

gulp.task("i18nAll", i18nAllTask);



function scriptEnvTask(){
    return Q.nfcall(
        fs.writeFile,
        dirPath(scriptDir) + '_env.coffee',
        'module.exports = {version:"' + version + '",cdn:"' + dirPath(cdn) + version + '"};');
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
    return gulp.src(splitPaths(paths))
        .pipe(buildScript())
        .pipe(rename({extname:'.js'}))
        .pipe(gulp.dest(dirPath(distJs)));
}

gulp.task('script', ['scriptEnv'], scriptTask);

function scriptAllTask(){
    return scriptTask(dirPath(scriptDir) + "**/*.coffee");
}

gulp.task('scriptAll', ['scriptEnv'], scriptAllTask);



function cssEnvTask(){
    return Q.nfcall(
        fs.writeFile,
        dirPath(cssDir) + '_env.less',
        '@version:"' + version + '";@cdn:"' + dirPath(cdn) + version + '";');
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
    return gulp.src(splitPaths(paths))
        .pipe(buildCss())
        .pipe(rename({extname:'.css'}))
        .pipe(gulp.dest(dirPath(distCss)));
}

gulp.task('css', ['cssEnv'], cssTask);

function cssAllTask(){
    return cssTask(dirPath(cssDir) + "**/*.less");
}

gulp.task('cssAll', ['cssEnv'], cssAllTask);
