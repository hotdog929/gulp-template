# gulp-template-servlet-coffee-less
## 指令集

* addModule --module [moduleName] --template [templateName]

  ```
  gulp addModule --module site1/test
    if template is empty then use default template.
    copy following files :
      [templateDir]/default/script.coffee
        to [scriptDir]/site1/test.coffee
      [templateDir]/default/css.less
        to [cssDir]/site1/test.less
  ```
  
* addView --view [viewName] --template [templateName]
  
  ```
  gulp addView --view index --template single
    if template is empty then use default template.
    create following files :
      [templateDir]/single/html.html
        to [viewDir]/index.html
      [templateDir]/single/script.coffee
        to [scriptDir]/index.coffee
      [templateDir]/single/css.less
        to [cssDir]/index.less
  ```
  
* delModule --module [moduleName]

  ```
  gulp delModule --module site1/test
    delete following files :
      [scriptDir]/site1/test.coffee
      [cssDir]/site1/test.less
  ```

* delView --view [viewName]

  ```
  gulp delView --view index
    delete following files :
      [viewDir]/index.html
      [scriptDir]/index.coffee
      [cssDir]/index.less
  ```
  
* clean

  ```
  gulp clean
    delete following directory :
      [distDir]
      [javaI18nDir]
  ```
  
* copyWebLib

  ```
  gulp copyWebLib
    get dependencies in package.json
    copy all dependencies source to [distDirWithVersion] and [webLibDir]
  ```
  
* copyWebResource

  ```
  gulp copyWebResource
    copy all file in [webResourceDir] to [distDirWithVersion]
  ```

* i18n --paths [pathList]

  ```
  gulp i18n --paths src/main/i18n/en_US.jsonnet,src/main/i18n/zh_TW.jsonnet
    paths split by ','
    paths can use wildcard
    build following files :
      src/main/i18n/en_US.jsonnet
        to [javaI18nDir]/messages_en_US.properties
        to [distI18n]/en_US.js
      src/main/i18n/zh_TW.jsonnet
        to [javaI18nDir]/messages_zh_TW.properties
        to [distI18n]/zh_TW.js
  ```

* i18nAll

  ```
  gulp i18nAll
    build all jsonnet in [i18nDir]
  ```

* scriptEnv

  ```
  gulp scriptEnv
    use [versionFile] and [cdnFile] to create [scriptDir]/_env.coffee 
  ```

* script --paths [pathList]

  ```
  gulp script --paths src/main/webapp/coffee/index.coffee
    paths split by ','
    paths can use wildcard
    build following files :
      src/main/webapp/coffee/index.coffee
        to [distJs]/index.js
  ```

* scriptAll

  ```
  gulp scriptAll
    build all script in [scriptDir] to [distJs]
  ```

* cssEnv

  ```
  gulp cssEnv
    use [versionFile] and [cdnFile] to create [cssDir]/_env.less 
  ```

* css --paths [pathList]

  ```
  gulp script --paths src/main/webapp/less/index.less
    paths split by ','
    paths can use wildcard
    build following files :
      src/main/webapp/less/index.less
        to [distCss]/index.css
  ```

* cssAll

  ```
  gulp scriptAll
    build all css in [cssDir] to [distCss]
  ```

* build

  ```
  gulp build
    sequence run following task :
      clean
      copyWebLib
      copyWebResource
      i18nAll
      scriptEnv
      cssEnv
      scriptAll
      cssAll
  ```

* watch --view [viewName] --modules [moduleList]

  ```
  gulp watch --view index --modules main,popup
    modules can empty
    if following script changed : 
      [scriptDir]/**/*.index.coffee
      [scriptDir]/**/*.main.coffee
      [scriptDir]/**/*.popup.coffee
      then build [scriptDir]/**/index.coffee
        to [distJs]/**/index.js
    if following css changed : 
      [cssDir]/**/*.index.less
      [cssDir]/**/*.main.less
      [cssDir]/**/*.popup.less
      then build [cssDir]/**/index.less
        to [distCss]/**/index.css
  ```
