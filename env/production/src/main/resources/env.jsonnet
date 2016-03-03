(import "../../../../default/src/main/resources/env.jsonnet"){
    vars +: {
        host : "10.0.0.1",
        name : "production"
    }
    db.json +: {
        name : "productionDB"
    }
}