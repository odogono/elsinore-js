const Elsinore = require('elsinore');
console.log('browser common!');


const Entity = Elsinore.Entity;
const EntitySet = Elsinore.EntitySet;
const Component = Elsinore.Component;
const Query = Elsinore.Query;
const Registry = Elsinore.Registry;
const SchemaRegistry = Elsinore.SchemaRegistry;
const Util = Elsinore.Util;

const printIns = Elsinore.Util.printIns;
const toPascalCase = Elsinore.Util.toPascalCase;
const parseUri = Elsinore.Util.parseUri;
const getEntityIdFromId = Elsinore.Util.getEntityIdFromId;
const getEntitySetIdFromId = Elsinore.Util.getEntitySetIdFromId;
const setEntityIdFromId = Elsinore.Util.setEntityIdFromId;


export {getEntityIdFromId,getEntitySetIdFromId, setEntityIdFromId};
// const getEntityIdFromId = Elsinore.Util.getEntityIdFromId;


export {Component as Component};
export {Entity as Entity};
export {EntitySet as EntitySet};
export {Query as Query};
export {Registry as Registry};
export {SchemaRegistry as SchemaRegistry};






export function initialiseRegistry( doLogEvents ){
    let componentData;
    let registry = Registry.create();
    let options, load;

    if( _.isObject(doLogEvents) ){
        options = doLogEvents;
        doLogEvents = options.doLogEvents;
    }
    if( doLogEvents ){
        // log.debug('logging events');
        // logEvents( registry );
    }

    options = (options || {});
    load = _.isUndefined(options.loadComponents) ? true : options.loadComponents;

    if( load ){
        componentData = COMPONENTS;
        // log.debug('loaded components ', componentData);// + JSON.stringify(options) );
        // printIns( componentData );
        return registry.registerComponent( componentData, options )
            .then( () => registry )
    }

    return Promise.resolve(registry);
}


export function loadEntities( registry, fixtureName, entitySet, options ){
    let data;
    let lines;
    let result;

    // fixtureName = fixtureName || 'entity_set.entities.json';
    registry = registry || initialiseRegistry( options );
    result = registry.createEntitySet( entitySet, options );

    data = ENTITIES;

    // if( _.isString(fixtureName) ){
    //     if( fixtureName.indexOf('.json') === -1 ){
    //         fixtureName = fixtureName + '.json';
    //     }
    //     data = loadFixture( fixtureName );
    //     data = JSON.parse( data );
    // }
    if( _.isObject(fixtureName) ){
        data = fixtureName;
    }
    // } else {
    //     throw new Error('invalid fixture name specified');
    // }

    _.each( data, line => {
        let com = registry.createComponent( line );
        result.addComponent( com );
        return com;
    });

    return result;
}



const COMPONENTS = [

    {
        "uri":"/component/nickname",
        "description":"an entity identifiable by a name",
        "properties":{
            "nickname":{ 
                "type":"string",
                "pattern":"^[a-z_\\-\\[\\]\\\\^{}|`][a-z0-9_\\-\\[\\]\\\\^{}|`]{3,15}"
            }
        }
    },

    {
        "uri": "/component/username",
        "description": "an entity identifiable by a username",
        "properties": {
            "username": {
                "type": "string",
                "pattern": "^[a-z_\\-\\[\\]\\\\^{}|`][a-z0-9_\\-\\[\\]\\\\^{}|`]{3,15}"
            }
        }
    },

    {
        "uri": "/component/hostname",
        "properties": {
            "type": "string"
        }
    },

    {
        "uri": "/component/name",
        "properties":{
            "name":{  "type":"string", "minLength":3, "maxLength":64 }
        }
    },

    {
        "uri": "/component/topic",
        "properties":{
            "topic":{  "type":"string", "minLength":3, "maxLength":64 }
        }
    },

    {
        "uri": "/component/position",
        "properties":{
            "x": { "type": "number", "default": 0 },
            "y": { "type": "number", "default": 0 },
            "z": { "type": "number", "default": 0 },
            "w": { "type": "number", "default": 0 }
        }
    },


    {
        "uri": "/component/score",
        "properties": {
            "score": { "type":"integer" },
            "lives": { "type":"integer", "default": 3 }
        }
    },

    {
        "uri": "/component/realname",
        "properties":{
            "name":{  "type":"string", "minLength":3, "maxLength":64 }
        }
    },

    {
        "uri": "/component/command",
        "properties":{
            "id":{ "type":"string" },
            "keyword": { "type":"string" },
            "parameters":{  "type":"array" },
            "command":{ "type":"object", "description":"command object" },
            "status":{ "type":"string", "enum":[ "unprocessed", "processed" ] }
        }
    },

    {
        "uri": "/component/channel",
        "properties":{
            "name": { "type": "string" }
        }
    },

    {
        "uri": "/component/channel_member",
        "description": "describes a client who belongs to a channel",
        "properties":{
            "channel":{ "type": "integer", "format": "entity" },
            "client":{ "type": "integer", "format": "entity" }
        }
    },

    {
        "uri": "/component/channel",
        "properties":{
            "topic":{ "type":"string" }
        }
    },

    {
        "uri": "/component/mode/invisible",
        "properties": {}
    },

    {
        "uri": "/component/mode/invite_only",
        "properties": {}
    },

    {
        "uri": "/component/mode/channel_op",
        "properties": {}
    },

    {
        "uri": "/component/mode/limit",
        "description": "limits the members to this entity",
        "properties": {
            "limit": {"type": "integer"}
        }
    },

    {
        "uri": "/component/mode/private",
        "properties": {}
    },

    {
        "uri": "/component/tag",
        "properties":{
            "code":{ "type":"string" },
            "name":{ "type":"string" },
            "type":{ "type":"integer" }
        }
    },

    {
        "uri": "/component/geo_location",
        "description": "A geographical coordinate",
        "properties": {
            "latitude": { "type": "number" },
            "longitude": { "type": "number" },
            "altitude":{ "type":"number" },
            "accuracy": { "type":"number" }
        }
    },

    {
        "uri": "/component/radius",
        "properties":{
            "radius":{ "type":"number" }
        }
    },

    {
        "uri": "/component/flower",
        "properties":{
            "name":{ "type":"string" },
            "colour":{ "type":"string" }
        }
    },

    {
        "uri": "/component/animal",
        "properties":{
            "name":{ "type":"string" }
        }
    },
    
    {
        "uri": "/component/mineral",
        "properties":{
            "name":{ "type":"string" }
        }
    },
    
    {
        "uri": "/component/vegetable",
        "properties":{
            "name":{ "type":"string" }
        }
    },
    
    {
        "uri": "/component/status",
        "properties":{
            "status":{ "type":"string" }
        }
    }
];

const ENTITIES = [
{"@e":1, "@c": "/component/channel", "name":"ecs" },
{"@e":1, "@c": "/component/topic", "topic": "Entity Component Systems" },
{"@e":1, "@c": "/component/status", "status": "active"},

{"@e":2, "@c": "/component/channel", "name": "chat"},
{"@e":2, "@c": "/component/mode/limit", "limit": 10 },
{"@e":2, "@c": "/component/status", "status": "active"},

{"@e":3, "@c": "/component/channel", "name": "js"},
{"@e":3, "@c": "/component/mode/invite_only" },
{"@e":3, "@c": "/component/topic", "topic": "Javascript" },
{"@e":3, "@c": "/component/status", "status": "inactive"},

{"@e":4, "@c": "/component/channel", "name": "politics"},
{"@e":4, "@c": "/component/mode/invisible" },
{"@e":4, "@c": "/component/topic", "topic": "Welcome to Politics" },
{"@e":4, "@c": "/component/status", "status": "active"},

{"@e":5, "@c": "/component/username", "username":"aveenendaal"},
{"@e":5, "@c": "/component/nickname", "nickname":"alex"},
{"@e":5, "@c": "/component/name", "name": "Alexander Veenendaal" },
{"@e":5, "@c": "/component/status", "status": "active"},

{"@e":6, "@c": "/component/username", "username":"brussell"},
{"@e":6, "@c": "/component/nickname", "nickname":"bertie"},
{"@e":6, "@c": "/component/name", "name": "Bertrand Russell"},
{"@e":6, "@c": "/component/status", "status": "active"},

{"@e":7, "@c": "/component/username", "username":"cdarwin"},
{"@e":7, "@c": "/component/nickname", "nickname":"charles"},
{"@e":7, "@c": "/component/name", "name": "Charles Darwin" },
{"@e":7, "@c": "/component/mode/invisible" },

{"@e":8, "@c": "/component/username", "username":"amoyet"},
{"@e":8, "@c": "/component/nickname", "nickname":"alison"},
{"@e":8, "@c": "/component/name", "name": "Alison Moyet" },

{"@e":9, "@c": "/component/username", "username":"bgalindo"},
{"@e":9, "@c": "/component/nickname", "nickname":"beatrix"},
{"@e":9, "@c": "/component/name", "name": "Beatrix Galindo" },


{"@e":10, "@c": "/component/username", "username":"cporco"},
{"@e":10, "@c": "/component/nickname", "nickname":"carolyn"},
{"@e":10, "@c": "/component/name", "name": "Carolyn Porco" },

{"@e":11, "@c": "/component/username", "username":"dderbyshire"},
{"@e":11, "@c": "/component/nickname", "nickname":"delia"},
{"@e":11, "@c": "/component/name", "name": "Delia Derbyshire" },
{"@e":11, "@c": "/component/status", "status": "active"},


{"@e":12, "@c": "/component/channel_member", "channel": 1, "client": 5, "username":"aveenendaal", "cname":"ecs" },
{"@e":12, "@c": "/component/mode/channel_op" },

{"@e":13, "@c": "/component/channel_member", "channel": 1, "client": 6, "username":"brussell", "cname":"ecs" },

{"@e":14, "@c": "/component/channel_member", "channel": 1, "client": 8, "username":"amoyet", "cname":"ecs" },
{"@e":14, "@c": "/component/mode/invisible" },

{"@e":15, "@c": "/component/channel_member", "channel": 2, "client": 5, "username":"aveenendaal", "cname":"chat" },

{"@e":16, "@c": "/component/channel_member", "channel": 2, "client": 7, "username":"cdarwin", "cname":"chat" },
{"@e":16, "@c": "/component/mode/invisible" },

{"@e":17, "@c": "/component/channel_member", "channel": 2, "client": 11, "username":"dderbyshire", "cname":"chat" },
{"@e":17, "@c": "/component/mode/channel_op" },

{"@e":18, "@c": "/component/channel_member", "channel": 4, "client": 9, "username":"bgalindo", "cname":"politics" }
]