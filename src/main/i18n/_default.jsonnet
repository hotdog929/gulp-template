{
    lang : "zh_TW",
    langs : ["zh_TW","en_US"],

    siteTitle(num) :: "第"+num+"頁",

    "/index" : {
        title : "首頁",
        icon : "index_icon"
    },

    "/site1" : {
        title : $.siteTitle(1),
        icon : "site1_icon"
    },

    "/site2" : {
        title : $.siteTitle(2),
        icon : "site2_icon"
    },
}