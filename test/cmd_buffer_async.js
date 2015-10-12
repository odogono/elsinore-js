import _ from 'underscore';
import test from 'tape';
import Backbone from 'backbone';
import Sinon from 'sinon';


import {
    Elsinore, 
    initialiseRegistry, 
    loadEntities, 
    loadFixtureJSON,
    requireLib
} from './common';


let CmdBuffer = requireLib('cmd_buffer/async');

let Utils = Elsinore.Utils;
let Entity = Elsinore.Entity;
let Component = Elsinore.Component;

test('adding a component with no entity id', t => {
    return initialiseRegistry().then( registry => {
        let cb = CmdBuffer.create();
        let es = createEntitySet();
        let com = createComponent();

        return cb.addComponent( es, com )
            .then(added => {
                reportUpdates( t, es, 1, 0, 0, 1, 0, 0 );
            })
            .then( () => t.end() )
            
        })
        .catch( err => log.error('test error: %s', err.stack) )
});

test('adding a component with an eid, but not a member of the es', t => {
    return initialiseRegistry().then( registry => {
        let cb = CmdBuffer.create();
        let es = createEntitySet( 50 );
        let com = createComponent( {_e:10} );

        return cb.addComponent( es, com )
            .then(added => {
                reportUpdates( t, es, 1, 0, 0, 1, 0, 0 );
            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('adding a component with an eid, a non-member of the es', t => {
    return initialiseRegistry().then( registry => {
        let cb = CmdBuffer.create();
        let es = createEntitySet( 50 );
        let com = createComponent( {_e:11, _es:50} );

        return cb.addComponent( es, com )
            .then( added => {
                reportUpdates( t, es, 1, 0, 0, 1, 0, 0 );
                // t.equal( es.entitiesAdded.length, 1, 'one entity should be added' );
                // t.equal( es.componentsAdded.length, 1, 'one component should be added' );
                t.ok( Component.isComponent(added) );

            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});


test('adding a component with an eid, an existing member of the es', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet( 50, [11] );
    let com = createComponent( {_e:11, _es:50} );

    return cb.addComponent( es, com )
        .then( added => {
            reportUpdates( t, es, 0, 1, 0, 1, 0, 0 );
            t.ok( Component.isComponent(added) );
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});


test('updating an existing component', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet( 50, [11] );
    let com = createComponent( {_e:11, _es:50} );

    es.getEntity = function(entityId){
        let e = createEntity(entityId);
        e.hasComponent = () => true;
        return Promise.resolve(e);
    }
    return cb.addComponent( es, com )
        .then( added => {
            reportUpdates( t, es, 0, 1, 0, 0, 1, 0 );

            // t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated' );
            // t.equal( es.componentsUpdated.length, 1, 'one component should be updated' );
            t.ok( Component.isComponent(added) );
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('adding an entity with multiple components', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet(60);
    let e = Entity.create();
    let coms = createComponent({tag:'soft',_s:3},{tag:'hard',_s:10});
    _.each( coms, com => e.addComponent(com) );
    // printIns( e.getComponentBitfield().toString() );

    return cb.addEntity( es, e )
        .then( added => {
            reportUpdates( t, es, 1, 0, 0, 2, 0, 0 );
            // t.equal( es.entitiesAdded.length, 1, 'one entity should be added');
            // t.equal( es.componentsAdded.length, 2, 'two components should be added');
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) ) 
});

test('updating an entity with a new component', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet(62, [10]);
    let e = Entity.create(10,62);
    let coms = createComponent({tag:'soft',_s:3},{tag:'hard',_s:10});
    _.each( coms, com => e.addComponent(com) );
    // printIns( e.getComponentBitfield().toString() );


    es.getEntity = function(entityId){
        // let e = createEntity(entityId);
        e.hasComponent = (cIId) => {
            return (cIId.getSchemaId() === 3);
        };
        return Promise.resolve(e);
    }

    return cb.addEntity( es, e )
        .then( added => {
            reportUpdates( t, es, 0, 1, 0, 1, 1, 0 );
            // t.equal( es.entitiesAdded.length, 0, 'no entities should be added');
            // t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated');
            // t.equal( es.componentsAdded.length, 1, 'one component should be added');
            // t.equal( es.componentsUpdated.length, 1, 'one component should be updated' );
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});


test('removing a component from an entity', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet(63, [12]);
    let e = Entity.create(12,63);
    let coms = createComponent({tag:'soft',_s:4},{tag:'hard',_s:10},{tag:'kik',_s:13});
    _.each( coms, com => e.addComponent(com) );
    // printIns( e.getComponentBitfield().toString() );

    es.getEntity = function(entityId){
        // let e = createEntity(entityId);
        e.hasComponent = (cIId) => true;
        return Promise.resolve(e);
    }

    return cb.removeComponent( es, coms[1] )
        .then( added => {
            reportUpdates( t, es, 0, 1, 0, 0, 0, 1 );
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('removing the last component from an entity', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet(63, [12]);
    let e = Entity.create(12,63);
    let com = createComponent({tag:'soft',_s:4});
    
    e.addComponent(com);

    es.getEntity = function(entityId){
        e.hasComponent = (cIId) => true;
        return Promise.resolve(e);
    }

    return cb.removeComponent( es, com )
        .then( added => {
            reportUpdates( t, es, 0, 0, 1, 0, 0, 1 );
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});



test('removing all components from an entity', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet(63, [12]);
    let e = Entity.create(12,63);
    let coms = createComponent({tag:'soft',_s:4},{tag:'hard',_s:10},{tag:'kik',_s:13});
    _.each( coms, com => e.addComponent(com) );
    // printIns( e.getComponentBitfield().toString() );

    es.getEntity = function(entityId){
        e.hasComponent = (cIId) => true;
        return Promise.resolve(e);
    }

    return cb.removeComponent( es, coms )
        .then( added => {
            reportUpdates( t, es, 0, 0, 1, 0, 0, 3 );
            // t.equal( es.entitiesUpdated.length, 0, 'no entities should be updated');
            // t.equal( es.entitiesRemoved.length, 1, 'one entitiy should be removed');
            // t.equal( es.componentsUpdated.length, 0, 'no components should be updated');
            // t.equal( es.componentsRemoved.length, 3, 'three components should be removed');
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});


test('removing an existing entity', t => {
    let cb = CmdBuffer.create();
    let es = createEntitySet(64, [13]);
    let e = Entity.create(13,64);
    let coms = createComponent({tag:'soft',_s:4},{tag:'hard',_s:10},{tag:'kik',_s:13});
    _.each( coms, com => e.addComponent(com) );
    // printIns( e.getComponentBitfield().toString() );

    es.getEntity = function(entityId){
        // let e = createEntity(entityId);
        e.hasComponent = (cIId) => true;
        // e.hasComponent = (cIId) => {
        //     return (cIId.getSchemaId() === 3);
        // };
        return Promise.resolve(e);
    }

    return cb.removeEntity( es, e )
        .then( added => {
            reportUpdates( t, es, 0, 0, 1, 0, 0, 3 );
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('adding multiple', t => {
    return initialiseRegistry().then( registry => {
        let cb = CmdBuffer.create();
        let es = createEntitySet(66);
        let data = [
            {"_e":1, "id": "/component/channel", _s:1, "name":"ecs" },
            {"_e":1, "id": "/component/topic", _s:2, "topic": "Entity Component Systems" },
            {"_e":5, "id": "/component/username", _s:3, "username":"aveenendaal"},
            {"_e":5, "id": "/component/nickname", _s:4, "nickname":"alex"},
            {"_e":12, "id": "/component/channel_member", _s:5, "channel": 1, "client": 5 },
        ];

        let entities = loadEntities( registry, data );
        
        return cb.addEntity( es, entities.models )
            .then( added => {
                reportUpdates( t, es, 3, 0, 0, 5, 0, 0 );
            })
            .then( () => t.end() )
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


function reportUpdates( t, es, eAdded, eUpdated, eRemoved, cAdded, cUpdated, cRemoved ){
    t.equal( es.entitiesAdded.length, eAdded, eAdded + ' entities should be added');
    t.equal( es.entitiesUpdated.length, eUpdated, eUpdated + ' entities should be updated');
    t.equal( es.entitiesRemoved.length, eRemoved, eRemoved + ' entity should be removed');
    t.equal( es.componentsAdded.length, cAdded, cAdded + ' components should be added');
    t.equal( es.componentsUpdated.length, cUpdated, cUpdated + ' components should be updated');
    t.equal( es.componentsRemoved.length, cRemoved, cRemoved + ' components should be removed');
}

/**
*   Creates a Mock ES that we can assert against
*/
function createEntitySet( entitySetId, entityIds, registry ){
    entityIds = _.map( entityIds, id => Utils.setEntityIdFromId(id,entitySetId) );
    return _.extend({
        id: entitySetId,
        update: function( eAdd, eUp, eRem, cAdd, cUp, cRem ){
            // printIns( arguments, 1 );
            [this.entitiesAdded,
            this.entitiesUpdated,
            this.entitiesRemoved,
            this.componentsAdded,
            this.componentsUpdated,
            this.componentsRemoved] = arguments;
            return Promise.resolve(true);
        },
        getEntity: function( entityId, options ){
            if( entityIds.indexOf(entityId) !== -1 ){
                return Promise.resolve( createEntity(entityId) );
            }
            return Promise.resolve({});
        },
        getRegistry: function(){
            return registry;
        }
    }, Backbone.Events );
}


/**
*   Creates a mock component
*/
function createComponent( attrs ){
    // let args = _.toArray(arguments);
    if( arguments.length > 1 ){
        return _.map( arguments, arg => {
            return createComponent.call(this,arg);
            } );
    }

    // if( entitySetId ){
    //     entityId = Utils.setEntityIdFromId( entityId, entitySetId );
    // }

    var result = Component.create( attrs, {parse:true} );
    // printIns( result );
    return result;
}


function createEntity( entityId ){
    return Elsinore.Entity.create( entityId );
}
