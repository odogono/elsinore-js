'use strict';

// let Promise = require('bluebird');
let _ = require('underscore');
let test = require('tape');

let Common = require('../common');
let PromiseQ = require('promise-queue');

let Es = require('event-stream');
let Sinon = require('sinon');

let Elsinore = require('../../lib');

let EntityFilter = Elsinore.EntityFilter;
let EntitySet = Elsinore.EntitySet;
let Entity = Elsinore.Entity;
let Query = Elsinore.Query;
let Registry = Elsinore.Registry;
let Utils = Elsinore.Utils;

let LevelEntitySet = require('../../lib/entity_set_level');
let LU = require('../../lib/entity_set_level/utils');

test('get all the component defs', t => {
    createEntitySet( null, {loadComponents:true, logEvents:false, debug:false})
        .then( entitySet => { return Promise.resolve()
            .then( () => entitySet.getComponentDefs() )
            .then( (defs) => {
                defs = _.reduce( defs, (result,def) => {
                    result[def.uri] = def.hash;
                    return result;
                },{});

                t.equals( defs['/component/status'], '417b8cb5' );
            })
            .then( () => destroyEntitySet(entitySet, true) )
            .then( () => t.end() )

        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
})

test('returns the newest version of the schema', t => {
    let registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
    let schemaA = { id:'/component/channel', properties:{ name:{type:'string'} }};
    let schemaB = { id:'/schema/alpha', properties:{ channel:{type:'string'} }};

    return createEntitySet( registry, {clear:true})
        .then( entitySet => { return Promise.resolve()
            .then( () => entitySet.registerComponentDef(schemaA) )
            .then( () => entitySet.registerComponentDef(schemaB) )
            .then( () => entitySet.getComponentDef('/schema/alpha') )
            .then( schema => {
                t.ok( schema.obj.properties.channel, 'the 2nd version is the one returned' );
                return true;
            })
            .then( () => destroyEntitySet(entitySet, true) )
            .then( () => t.end() )
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('registering the same schema again throws an error', t => {
    let schemaA = { id:'/component/channel', properties:{ name:{type:'string'} }};

    return createEntitySet( null, {loadComponents:false, logEvents:false, debug:false} )
        .then( entitySet => { return Promise.resolve()
            // register once...
            .then( () => entitySet.registerComponentDef(schemaA) )
            // register again
            .then( () => entitySet.registerComponentDef(schemaA) )
            // error
            .catch( err => {
                t.equal(err.message,'schema /component/channel (ec3bd75b) already exists'); 
                return;
            })
            .then( () => destroyEntitySet(entitySet, true) )
            .then( () => t.end() )
        })
});


test('registering a schema and then retrieving it', t => {
    let schemaA = { id:'/component/channel', properties:{ name:{type:'string'} }};
    let schemaB = { id:'/component/topic', properties:{ topic:{type:'string'} }};
    let schemaC = { id:'/component/status', properties:{ status:{type:'string'} }};

    return createEntitySet( null, {componentDefId:104, loadComponents:false, logEvents:false, debug:false} )
        .then( entitySet => entitySet.registerComponentDef(schemaA) )
        .then( entitySet => entitySet.registerComponentDef(schemaB) )
        .then( entitySet => entitySet.registerComponentDef(schemaC) )
        .then( entitySet => {
            let registryId = entitySet.getRegistry().getIId( schemaA.id );
            // log.debug('registry id is ' + registryId );
            // t.equal(err.message,'schema /component/channel (ec3bd75b) already exists'); 
            // printIns( entitySet, 1 );
            return entitySet;
        })
        .then( entitySet => destroyEntitySet(entitySet, true) )
        .then( () => t.end() )
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});



test('registers existing component defs with the registry when opened', t => {
    let registry;
    
    let schema = {
        channel: { id:'/component/channel', properties:{ name:{type:'string'} }},
        topic: { id:'/component/topic', properties:{ topic:{type:'string'} }},
        status: { id:'/component/status', properties:{ status:{type:'string'} }}        
    }

    // create a new ES, register the component defs, then remove the ES
    return createEntitySet( null, {loadComponents:false, clear:true, debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => entitySet.registerComponentDef(schema) )
        // .then( entitySet => printKeys(entitySet) )
        .then( entitySet => registry.removeEntitySet(entitySet) )
        
        // create a new registry and ES which reads from the previous instantiation
        .then( () => createEntitySet( null, {loadComponents:false, clear:false, open:true, debug:false}) )
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        
        // confirm we still have the components registered by attempting to instantiate one
        .then( entitySet => {
            let c = registry.createComponent( '/component/channel', {name:'tali'});
            t.equal( c.get('name'), 'tali' );
            // printIns( registry.schemaRegistry, 1 );
            // printIns( entitySet._db, 1 );
            return entitySet;
        })
        .then( entitySet => destroyEntitySet(entitySet, true) )
        .then( () => t.end() )
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});


test('adding a component without an id or an entity id creates a new component and a new entity', t => {
    let registry;

    return createEntitySet( null, {loadComponents:true, clear:true, debug:false, esId:10})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            let component = registry.createComponent( {id:'/component/position', x:15,y:2} );
            return entitySet.addComponent( component )
                .then( component => entitySet.getEntity(component.getEntityId()) )
                .then( entity => {
                    t.ok( entity.Position, 'entity should have position' );
                    t.equals( entity.Position.get('x'), 15, 'component attr saved' );
                })
                .then( () => entitySet );
        })
        .then( entitySet => destroyEntitySet(entitySet, true) )
        .then( () => t.end() )
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});


test('adding several components without an entity adds them to the same new entity', function(t){
    let eventSpy = Sinon.spy();
    let registry;

    return createEntitySet( null, {loadComponents:true, clear:true, debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            entitySet.on('all', eventSpy);
            return entitySet.addComponent([
                registry.createComponent( '/component/flower', {colour:'yellow'}),
                registry.createComponent( '/component/radius', {radius:2.0, author:'alex'} )
                ])
            .then( components => entitySet.getEntity(components[0].getEntityId()) )
            .then( function(entity){
                t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
                t.assert( entity.Flower, 'the entity should have a Flower component' );
                t.assert( entity.Radius, 'the entity should have a Radius component' );
            })
            .then( () => destroyEntitySet(entitySet, true) )
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )

        })
});


test('removing a component from an entity with only one component', t => {
    let eventSpy = Sinon.spy();
    let registry;

    return createEntitySet( null, {loadComponents:true, clear:true, debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            entitySet.on('all', eventSpy);
            // Common.logEvents( entitySet );
            return entitySet.addComponent(
                registry.createComponent( '/component/position', {x:15,y:2}))
            .then( component => {
                // log.debug('removed! ' + component.getEntityId() );
                return component;
            })
            .then( component => entitySet.removeComponent(component) )
            // .then( () => printKeys(entitySet, '_ent_bf', {values:false} ) )
            // .then( component => entitySet.getEntity(component.getEntityId()) )
            .then( (entity) => {
                t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');
                t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');
                // printE( entity );
            })
            .then( () => destroyEntitySet(entitySet, true) )
            .then( () => t.end() )
        })
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('should add an entity only once', t => {
    let eventSpy = Sinon.spy();
    let registry;
    let entities;

    return Common.initialiseRegistry( {loadComponents: true} )
        .then( _r => {registry = _r; entities = Common.loadEntities(_r);} )
        // NOTE: we have to set the entity seed explicitly to match the loaded entities
        .then( () => createEntitySet( registry, {esId:10, entityIdSeed:1, clear:true, debug:false}) )
        .then( entitySet => {
            let entity = entities.at(0);
            // Common.logEvents(entitySet);
            entity.set({id:0});

            return entitySet.addEntity( entity )
                .then( () => entitySet.size() )
                .then( size => t.equals(size, 1) )
                .then( () => destroyEntitySet(entitySet, true) )
                .then( () => t.end() )
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});


test('should remove an entity', t => {
    let eventSpy = Sinon.spy();
    let registry;
    let entities;

    return Common.initialiseRegistry( {loadComponents: true} )
        .then( _r => {registry = _r; entities = Common.loadEntities(_r);} )
        // NOTE: we have to set the entity seed explicitly to match the loaded entities
        .then( () => createEntitySet( registry, {esId:10, entityIdSeed:1, clear:true, debug:false}) )
        .then( entitySet => {
            let entity = entities.at(0);
            // Common.logEvents(entitySet);

            return entitySet.addEntity( entity )
                .then( (e) => { entity = e; return entitySet.size()})
                .then( size => t.equals(size, 1, 'the es should have one entity') )

                .then( () => entitySet.removeEntity(entity) )
                .then( () => entitySet.size(true) )
                .then( size => t.equals(size, 0, 'the es should be empty') )

                .then( () => destroyEntitySet(entitySet, true) )
                .then( () => t.end() )
                .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
        });
});

test('should emit an event when an entity is added and removed', t => {
    // let addSpy = Sinon.spy(), removeSpy = Sinon.spy();
    let registry;
    let entities;

    return Common.initialiseRegistry( {loadComponents: true} )
        .then( _r => {registry = _r; entities = Common.loadEntities(_r);} )
        .then( () => createEntitySet( registry, {esId:10, entityIdSeed:1, clear:true, debug:false}) )
        .then( entitySet => {
            let addCalled = false, removeCalled = false;
            // Common.logEvents( entitySet );
            // entitySet.on('entity:add', addSpy );
            entitySet.on('entity:add', () => addCalled = true )
            entitySet.on('entity:remove', () => removeCalled = true );
            return entitySet.addEntity( entities.at(0) )
                .then( () => t.ok( addCalled, 'entity:add should have been called' ) )
                .then( () => entitySet.removeEntity( entities.at(0)) )
                .then( () => t.ok( removeCalled, 'entity:remove should have been called' ) )
                .then( () => destroyEntitySet(entitySet, true) )
                .then( () => t.end() )
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('adding an existing entity changes its id if it didnt originate from the entityset', t => {
    let registry;
    return createEntitySet( null, {esId:205, loadComponents:true, clear:true, debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            let entity = registry.createEntity( { id:'/component/flower', colour:'white'}, {id:12} );
            // Common.logEvents( entitySet );
            return entitySet.addEntity( entity )
            .then( (entity) => {
                // printE( entity );
                t.notEqual( entity.getEntityId(), 12, 'the entity id will have been changed' );
                t.equal( entity.getEntitySetId(), 205, 'the entityset id will have been set' );
            })
            .then( () => destroyEntitySet(entitySet, true) )
            .then( () => t.end() )
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('adding an existing entity doesnt changes its id if it originated from the entityset', t => {
    let registry;
    return createEntitySet( null, {esId:205, loadComponents:true, clear:true, debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            let entity = registry.createEntity( { id:'/component/flower', colour:'white'}, { id:12, esid:205} );
            // Common.logEvents( entitySet );
            // printE( entity );
            return entitySet.addEntity( entity )
                .then( (entity) => {
                    // printIns( entity,1 );
                    // printE( entity );
                    t.equal( entity.getEntitySetId(), 205, 'the entityset id will have been set' );
                    t.equal( entity.getEntityId(), 12, 'the entity id will have been changed' );
                })
                .then( () => destroyEntitySet(entitySet, true) )
                .then( () => t.end() )
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('updating entity references when adding', t => {
    let registry;
    let eventSpy = Sinon.spy();

    let data = [
        {"_e":1, "id": "/component/channel", "name":"ecs" },
        {"_e":1, "id": "/component/topic", "topic": "Entity Component Systems" },
        {"_e":5, "id": "/component/username", "username":"aveenendaal"},
        {"_e":5, "id": "/component/nickname", "nickname":"alex"},
        {"_e":12, "id": "/component/channel_member", "channel": 1, "client": 5 },
    ];

    // when entities are added, their previous ids are recorded
    // when a component is committed, any fields containing entity-refs are reconciled
    return createEntitySet( null, {esId:205, loadComponents:true, clear:true, debug:false})
        .then( entitySet => {registry = entitySet.getRegistry(); return entitySet} )
        .then( entitySet => {
            let entities = Common.loadEntities( registry, data );
            // Common.logEvents( entitySet );
            entitySet.on('all', eventSpy);
            // printE( entities );
            return entitySet.addEntity( entities, {batch:true, execute: false} )
                .then( added => {
                    // printIns( entitySet._cmdBuffer.cmds, 3 );
                    return entitySet.flush();
                })
                .then( () => {
                    t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called');
                    t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
                    let componentEvt = eventSpy.args[0][1];
                    let entityEvt = eventSpy.args[1][1];
                    
                    t.equal( componentEvt[4].get('channel'), entityEvt[0].id, 
                        'the channel attr should have been updated to the new entity id' );
                });
        })
        .then( () => t.end() )
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
})


// test('registering and removing component defs reuses ids', t => {
//     let schemaA = { id:'/component/channel', properties:{ name:{type:'string'} }};
//     let schemaB = { id:'/component/topic', properties:{ topic:{type:'string'} }};
//     let schemaC = { id:'/component/status', properties:{ status:{type:'string'} }};

//     return createEntitySet( null, {loadComponents:false, logEvents:false} )
//         // .then( entitySet => {
//         //     log.debug('returned');
//         //     printIns( arguments, 1 );
//         //     return entitySet;
//         // })
//         .then( entitySet => entitySet.registerComponentDef(schemaA) )
//         .then( entitySet => entitySet.registerComponentDef(schemaB) )
//         .then( entitySet => entitySet._loadComponentDefs() )
//         .then( defs => {
//             printIns( defs );
//             return true;
//         })
//         .then( () => t.end() )
//         .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
// });


function createEntitySet( registry, options ){
    let entitySet;
    let path;
    options = options || {};
    // let open = (options.open === undefined) ? true : options.open;
    let clearExisting = options.clear === undefined ? true : options.clear;
    options.leveldb = { path: Common.pathVarFile( (options.path || 'test/lvl/entity.ldb'), clearExisting ) };
    
    options.leveldb.db = require('memdown');
    // printIns( options.leveldb.db, 1);
    // options.leveldb = {db: require('memdown'), active:true};
    
    return (registry ? Promise.resolve(registry) : Common.initialiseRegistry( options ))
        .then( registry => registry.createEntitySet( LevelEntitySet, options ) )
        // .then( entitySet => {
        //     // if( open ){ return entitySet.open(options); }
        //     return entitySet;
        // })
        // .then( entitySet => {
        //     // NOTE: MemDOWN does not appear to clear itself between uses
        //     if( open && clearExisting ){
        //         return entitySet.clear();
        //     }
        //     return entitySet;
        // })
}


function printKeys( entitySet, key, options ){
    if( _.isObject(key) ){
        options = key;
        key = null;
    }
    options = options || {};
    if( key ){
        options.gte = key + LU.KEY_START,
        options.lte = key + LU.KEY_LAST
    }
    return LU.printKeys( entitySet._db, entitySet._pQ, options )
        .then( () => entitySet );
}

function destroyEntitySet( entitySet, clear ){
    let registry = entitySet.getRegistry();
    
    return Promise.resolve(entitySet)
        .then( () => {
            if( clear ){
                return entitySet.clear()
            }
            return entitySet;
        })
        .then( () =>  registry.removeEntitySet(entitySet) )
        .then( () => entitySet )
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
}