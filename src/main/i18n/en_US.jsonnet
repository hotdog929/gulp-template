(import "_default.jsonnet") + {
    lang : "en_US",

    siteTitle(num) :: "Site"+num,

    "/index" : {
        title : "Index"
    },
}