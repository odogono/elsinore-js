var test = require('tape');
var Common = require('./common');
var Es = require('event-stream');
var P = require('bluebird');
P.longStackTraces();

var entities, registry, storage, ComponentDefs;


test("create an entityset with all the entities in storage", function (t) {
    return beforeEach()
        .then(function(){
            return storage.createEntitySet()
        })
        .then(function(es){
            t.equals( es.length, 4, "four entities in the entityset" );
            t.end();
        });
});

test('create an entityset with selected entities in storage', function(t){
    return beforeEach()
        .then(function(){
            return storage.createEntitySet({include:[ ComponentDefs.Position ]})
        })
        .then(function(es){
            t.equals( es.length, 2, "two entities have the Position component" );
            t.end();
        });
});

test('create an entityset with selected included/excluded entities in storage', function(t){
    return beforeEach()
        .then( function(){
            return storage.createEntitySet({include:[ ComponentDefs.Position ], exclude:[ ComponentDefs.Realname], debug:true});
        })
        .then(function(es){
            t.equals( es.length,1 );
            t.end();
        });
});

test('add a new entity with component', function(t){
    var self = {};
    return beforeEach()
        .then( function(){
            return storage.createEntitySet();
        })
        .then( function(es){
            return self.entitySet = es;
        })
        .then(function(es){
            return registry.createEntity( [{schema:'realname', name:'jon snow'}, 'score'] );
        })
        .then(function(ent){
            t.equals( self.entitySet.length, 5 );
            t.end();
        });
});

test('remove a component', function(t){
    var self = this;
    return beforeEach()
        .then( function(){
            return storage.createEntitySet();
        })
        .then( function(es){
            return self.entitySet = es;
        })
        .then(function(es){
            t.equals( es.length, 4 );
            // grab the first component
            var ents = es.entities;
            return registry.destroyEntity( ents[0] );
        })
        .then( function(){
            t.equals( self.entitySet.length, 3 );
            t.end();
        })
});

// beforeEach( function(){
//     this.storage.on('all', function(){
//         log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
//     });
// })

function beforeEach(t) {
    var FixtureComponents = Common.fixtures.components;
    return Common.createAndInitialize().then(function(pStorage){ 
        storage = pStorage;
        registry = storage.registry;
        ComponentDefs = registry.ComponentDef;
    })
    // register components
    .then( function(){
        return registry.registerComponent( FixtureComponents );
    })
    // load entities into storage
    .then( function(){
        var JSONComponentParser = require('../lib/streams').JSONComponentParser;
        return new Promise(function(resolve){
            var s = Common.createFixtureReadStream('entity_set.entities.ldjson')
                // convert JSON objects into components by loading into registry
                .pipe( JSONComponentParser(registry) )
                .pipe(Es.through( null, function end(){
                    entities = registry.storage.entities;
                    return resolve( entities );
                }));
            });
    });
}