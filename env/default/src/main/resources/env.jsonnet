{
    vars : {
        host : "127.0.0.1"
        port : 8080
        name : "test"
    }

    "env.json" : {
        url : "http://" + $.vars.host + ":" + $.vars.port + "/" + vars.name
    }

    "db.json" : {
        host : $.vars.host
        port : 27017
        db : $.vars.name
    }
}