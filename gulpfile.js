var webappDir = 'src/main/webapp';
var info = {
    scriptFilenameExtension : "coffee",
    cssFilenameExtension : "less",
    htmlFilenameExtension : "html",
    gulpTemplateDir : 'gulp_template',
    nodeModulesDir : 'node_modules',
    webappDir : webappDir,
    webLibDir : webappDir + '/lib',
    webResourceDir : webappDir + '/resource',
    viewsDir : webappDir + '/WEB-INF/view',
    scriptDir : webappDir + '/coffee',
    cssDir : webappDir + '/less',
    i18nDir : 'src/main/i18n',
    javaI18nDir : 'src/main/resources/i18n',
    versionFile : 'src/main/resources/version.properties',
    cdnFile : 'src/main/resources/cdn.properties',
    javaI18nFileName : 'messages_#{file}.properties',
    jsWebI18n : 'jsWebI18n',
    distDir : webappDir + '/dist'
};

var gulp = require('gulp-param')(require('gulp'), process.argv);
var servletExpansion = require('gulp-template-servlet-expansion');
gulp = servletExpansion(gulp, info);
info = servletExpansion.info;
require('gulp-template-expansion-script-coffee')(servletExpansion);
require('gulp-template-expansion-css-less')(servletExpansion);
