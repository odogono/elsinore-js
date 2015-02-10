var _ = require('underscore');
var test = require('tape');

var Common = require('./common');


var Es = require('event-stream');
var Sinon = require('sinon');
var Promise = require('bluebird');
Promise.longStackTraces();

var Elsinore = require('../lib');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;

var FileSystemEntitySet = require('../lib/fs_entity_set');


test('creating a filesystem entityset', function(t){
    var registry = initialiseRegistry(true);
    var entitySet = registry.createEntitySet( FileSystemEntitySet );

    t.ok( FileSystemEntitySet.isFileSystemEntitySet(entitySet), 'the created entityset should be a FileSystemEntitySet' );

    t.end();
});


test('adding a component without an id or an entity id creates a new component and a new entity', function(t){
    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            var registry = entitySet.getRegistry();
            return entitySet.addComponent( registry.createComponent( '/component/position', {x:15,y:2}) );
        })
        .then( function(entitySet){
            // retrieve the first entity in the set
            return entitySet.at(0)
                .then( function(entity){
                    t.ok( entity.Position, 'entity should have position' );
                    t.equals( entity.Position.get('x'), 15 );
                    t.end();
                });
        });
});

test('retrieving a non-existant entity', function(t){
    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            return entitySet.getEntity( 15 )
                .then( null, function(err){
                    t.equal( 'entity not found: 15', err.message );
                    t.end();
                });
        });
});

test('retrieving an existant entity', function(t){
    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            var e = Entity.create( 43 );
            return entitySet.addEntity( e );
        })
        .then( function(entitySet){
            return entitySet.getEntity( 43 )
                .then( function(entity){
                    t.equal( entity.id, 43 );
                    t.end();
                });
        });
});


test('adding several components without an entity adds them to the same new entity', function(t){
    var eventSpy = Sinon.spy();
    var entitySet;
    var registry;

    return initialiseAndOpenEntitySet()
        .then( function(es){
            entitySet = es;
            registry = entitySet.getRegistry();
            entitySet.on('all', eventSpy);

            return entitySet.addComponent( [
                registry.createComponent( '/component/flower', {colour:'yellow'}),
                registry.createComponent( '/component/radius', {radius:2.0, author:'alex'} )
                ])
                .then( function(){
                    return entitySet.at(0);
                });
        })
        .then( function(entity){
            t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
            t.assert( entity.Flower, 'the entity should have a Flower component' );
            t.assert( entity.Radius, 'the entity should have a Radius component' );
            t.end();
        });

});


test('adding a component generates events', function(t){
    var eventSpy = Sinon.spy();
    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            var registry = entitySet.getRegistry();
            entitySet.on('all', eventSpy);
            return entitySet.addComponent( [
                registry.createComponent( '/component/position', {id:1,_e:2, x:19, y:-2}),
                registry.createComponent( '/component/nickname', {id:2,_e:2, nick:'isaac'})
            ]);
        })
        .then( function(){

            t.equals( eventSpy.callCount, 2, 'two events should have been emitted' );
            t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
            t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
            t.end();
        })
});

test('adding an entity with components', function(t){
    var eventSpy = Sinon.spy();
    var entity;

    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            var registry = entitySet.getRegistry();
            entitySet.on('all', eventSpy);

            entity = Entity.create(16);
            entity.addComponent( registry.createComponent( '/component/position', {id:5, x:2,y:-2}) );
            entity.addComponent( registry.createComponent( '/component/score', {id:6, score:100}) );
            
            return entitySet.addEntity( entity )
                .then( function(){
                    return entitySet.at(0);
                })
        })
        .then( function(entity){
            t.equals( eventSpy.callCount, 2, 'four events should have been emitted' );
            t.equals( entity.Position.get('x'), 2 );
            t.end();
        });
});


test('should remove the entities component', function(t){
    var entity;
    var entitySet;
    var registry;
    return initialiseAndOpenEntitySet()
        .then( function(es){
            entitySet = es;
            registry = entitySet.getRegistry();
            entity = Entity.create(9);

            entity.addComponent( registry.createComponent( '/component/realname', {id:3, name:'tom smith'}) );
            return entitySet.addComponent( entity.Realname )
                .then( function(){
                    return entitySet.at(0);
                });
            })
        .then( function(entity){
            return entitySet.removeComponent( entity.Realname )
                .then( function(){
                    return entitySet.at(0);
                });
        })
        .then( function(entity){
            t.notOk( entity.hasComponents(), 'the single entity should have no components' );
            t.end();
        });
});


test.only('should remove a component reference from an entity', function(t){
    var entity;
    var entitySet;
    var registry;
    var loadedEntitySet;

    return initialiseAndOpenEntitySet()
        .then( function(es){
            entitySet = es;
            registry = entitySet.getRegistry();
            loadedEntitySet = loadEntities( registry, null, {memory:true} );

            entity = Entity.create();
            // entity.addComponent( registry.createComponent( '/component/position', {id:5, x:2,y:-2}) );
            // entity.addComponent( registry.createComponent( '/component/score', {id:6, score:100}) );
            
            entitySet.removeEntity( 2 , {debug:true})
                .then( function(){
                    t.end();
                });
        });

});


function initialiseAndOpenEntitySet(){
    var registry = initialiseRegistry( true );
    var entitySet = createEntitySet( registry );
    return entitySet.open();
}

function createEntitySet( registry ){
    var path = Common.pathVar( 'test/fes', true );
    var entitySet = registry.createEntitySet( FileSystemEntitySet, {path: path} );
    return entitySet;
}

function initialiseRegistry(logEvents){
    var componentData;
    var registry = Registry.create();
    // ComponentDefs = registry.ComponentDef;
    if( logEvents ){
        Common.logEvents( registry );
    }
    
    componentData = Common.loadComponents();

    registry.registerComponent( componentData );

    return registry;
}

function loadEntities( registry, fixtureName, options ){
    var data;
    var lines;
    var result;
    var memoryEntitySet;

    options || (options={});

    memoryEntitySet = _.isUndefined(options.memory) ? true : options.memory;

    fixtureName = fixtureName || 'entity_set.entities.ldjson';

    registry = registry || initialiseRegistry();

    if( memoryEntitySet ){
        result = registry.createEntitySet();
    } else {
        result = createEntitySet( registry );
    }

    data = Common.loadFixture( fixtureName );
    lines = data.split(/\r\n|\r|\n/g);

    // each line should be turned into a component, then added
    // to the resultant entityset
    if( memoryEntitySet ){
        _.map( _.compact( lines ), function(line){
            line = JSON.parse( line );
            var com = registry.createComponent( line );
            result.addComponent( com );
            return com;
        });
    } 
        
    return _.reduce( _.compact(lines), function(current, line){
        return current.then( function(){
            line = JSON.parse( line );
            var com = registry.createComponent( line );
            return result.addComponent( com );
        });
    }, Promise.resolve() );
}