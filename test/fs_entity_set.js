'use strict';

var _ = require('underscore');
var test = require('tape');

var Common = require('./common');

var Es = require('event-stream');
var Sinon = require('sinon');

var Elsinore = require('../lib');

var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;
var Entity = Elsinore.Entity;
let Query = Elsinore.Query;
var Registry = Elsinore.Registry;
var Utils = Elsinore.Utils;

var FileSystemEntitySet = require('../lib/fs_entity_set');


test('creating a filesystem entityset', function(t){
    var registry = initialiseRegistry();
    var entitySet = registry.createEntitySet( FileSystemEntitySet );

    t.ok( entitySet.isEntitySet, 'its a type of entityset');
    t.ok( entitySet.isAsync, 'its asynchronous in operation');
    t.ok( entitySet.isFileSystemEntitySet, 'its a FileSystemEntitySet' );
    
    t.end();
});



test('reading from an existing entityset', t => {
    return loadEntities()
        .then( (loadedEntitySet) => {
            var registry = loadedEntitySet.getRegistry();
            t.equals( loadedEntitySet.size(true), 18 );
            registry = initialiseRegistry( {loadComponents:false, logEvents:false} );
            return createEntitySet( registry, 
                {open:true, debug:true, clear:false, path:'test/fes'} );
        })
        // .catch(err => log.error('error' + err ))
        .then( (entitySet) => {
            // printIns( entitySet.getRegistry().schemaRegistry, 2 );
            t.equals( entitySet.size(true), 18 );
            t.end();
        })
        // .catch(err => log.error('error' + err ))
    t.end();
});

test.only('returns the newest version of the schema', t => {
    let registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
    var schemaA = { id:'/schema/alpha', properties:{ name:{type:'string'} }};
    var schemaB = { id:'/schema/alpha', properties:{ fullname:{type:'string'} }};

    return createEntitySet( registry, {path:'test/fesM', clear:true, open:true})
        .then( entitySet => entitySet.registerComponentDef(schemaA) )
        .then( entitySet => { log.debug('here'); return entitySet; })
        .then( entitySet => entitySet.registerComponentDef(schemaB) )
        .then( entitySet => {
            let schema = entitySet.getComponentDef('/schema/alpha');
            t.ok( schema.obj.properties.fullname, 'the 2nd version is the one returned' );
            t.end();
        })
        .catch( e => { log.error('entitySet.at error: ' + e); log.error( e.stack ); } )
});

test('the entityset registers schemas when it is opened', t => {
    let registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
    var schemaA = { id:'/schema/alpha', properties:{ name:{type:'string'} }};

    // create a new entityset and register the component def
    return createEntitySet( registry, {path:'test/fesM', clear:true, open:true})
        .then( entitySet => entitySet.registerComponentDef(schemaA) )
        .then( () => {
            registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
            return createEntitySet( registry, {path:'test/fesM', clear:false, open:true})
            })
        
        .then( entitySet => {
            let c = entitySet.getRegistry().createComponent( '/schema/alpha', {name:'tali'});
            t.equal( c.get('name'), 'tali' );
            t.end();
        })
});


test('adding a component without an id or an entity id creates a new component and a new entity', function(t){
    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            var component = entitySet.getRegistry().createComponent( '/component/position', {x:15,y:2})
            return entitySet.addComponent( component )
                .then( () => entitySet )
        })
        .then( entitySet => entitySet.at(0) )
        .then( entity => {
            // retrieve the first entity in the set
            t.ok( entity.Position, 'entity should have position' );
            t.equals( entity.Position.get('x'), 15 );
            t.end();  
        })
        .catch( e => { log.error('entitySet.at error: ' + e); log.error( e.stack ); } )
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
            return entitySet.addEntity( e )
                .then( function(){
                    return entitySet;
                });
        })
        .then( function(entitySet){
            return entitySet.getEntity( 43 )
                .then( function(entity){
                    t.equal( entity.id, 43, 'the id should be the same' );
                    t.end();
                });
        });
});


test('adding several components without an entity adds them to the same new entity', function(t){
    var eventSpy = Sinon.spy();

    return initialiseAndOpenEntitySet()
        .then( function(entitySet){
            var registry = entitySet.getRegistry();
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
            
            return entitySet.addEntity( entity );
                // .then( function(){
                //     return entitySet.at(0);
                // })
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


test('should remove a component reference from an entity', t => {
    return initialiseAndOpenEntitySet(false)
        .then( entitySet => {
            let registry = entitySet.getRegistry();
            let loadedEntitySet = loadEntities( registry, null, {memory:true} );
            let entityId;

            
            entitySet.addEntity( loadedEntitySet.at(0) )
                .then( entity => {
                    entityId = entity.getEntityId();
                    t.ok( entity.Status !== undefined, 'the entity should have the Status component' );
                    return entity;
                })
                .then( entity => entitySet.removeComponent(entity.Status) )
                .then( removedComponent => entitySet.getEntity(entityId) )
                .then( entity => {
                    t.ok( entity.Status === undefined, 'the entity should not have the Status component' );
                    return t.end();
                });
        })
        .catch( err => log.debug('error ' + err ) );
});

test('.query returns an entityset of entities', function(t){
    
    return loadEntities()
        .then( entitySet => entitySet.query( Query.all('/component/username').all('/component/nickname')) )
        .then( resultEntitySet => {
            t.ok( resultEntitySet.isEntitySet, 'the result is an entityset');
            t.equals( resultEntitySet.length, 3, '3 entities returned');
            t.end();
        }, (err) => {log.debug('query err ' + err); log.debug( err.stack); } )
        .catch(err => log.error('error' + err ))
        
});



test('.where returns entities which the attributes', function(t){
    var registry = initialiseRegistry();

    return loadEntities( registry )
        .then( entitySet => entitySet.query( Query.all('/component/status', Query.attr('status').equals('active'))) )
        .then( resultEntitySet => {
            t.equals( resultEntitySet.length, 2, '2 entities returned');
            t.end();
        });
});


function createEntitySet( registry, options ){
    var entitySet;
    var path;
    options = options || {};
    var clearExisting = options.clear === undefined ? true : options.clear;
    options.path = Common.pathVar( (options.path || 'test/fes'), clearExisting );

    registry = registry || initialiseRegistry( options );
    entitySet = registry.createEntitySet( FileSystemEntitySet, options );

    if( options.open ){
        return entitySet.open( options );
    }
    
    return entitySet;
}


function loadEntities( registry, fixtureName, options ){
    var data;
    var lines;
    var result;
    var memoryEntitySet;

    options || (options={});
    let clearExisting = options.clear === undefined ? true : options.clear;
    options.path = Common.pathVar( (options.path || 'test/fes'), clearExisting );

    memoryEntitySet = _.isUndefined(options.memory) ? false : options.memory;
    fixtureName = (fixtureName || 'query.entities');

    let loadedEntitySet = Common.loadEntities( registry, fixtureName, null, options );

    if( memoryEntitySet ){
        return loadedEntitySet;
    }

    result = createEntitySet( registry );

    if( !options.open ){
        return result;
    }

    return result.open()
        .then( () => result.addEntity(loadedEntitySet) )
        .then( () => result )

}