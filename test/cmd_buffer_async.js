import _ from 'underscore';
import test from 'tape';
import {Events} from 'odgn-backbone-model';
import BitField from 'odgn-bitfield';
import Sinon from 'sinon';



import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query, SchemaRegistry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    entityToString,
    logEvents,
    createLog,
    getEntityIdFromId,
    getEntitySetIdFromId,
    setEntityIdFromId,
} from './common';

import CmdBuffer from '../src/cmd_buffer/async';
import AsyncEntitySet from '../src/entity_set/async';

const Log = createLog('TestCmdBufferAsync');

test('adding a component with no entity id', t => {
    return initialiseRegistry().then( registry => {
        let cb = new CmdBuffer();
        let es = createEntitySet(registry);
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
        let cb = new CmdBuffer();
        let es = createEntitySet(registry,50);
        let com = createComponent( {'@e':10} );

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
        const cb = new CmdBuffer();
        const com = createComponent( {'@e':11, '@es':51} );
        const es = createEntitySet(registry,50);
        
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


test('adding a component with an eid, an existing member of the es', async t => {
    try{
    const registry = await initialiseRegistry();
    const cb = new CmdBuffer();
    const com = createComponent( {'@e':11, '@es':50} );
    // Log.debug('com', com.attributes, com.getEntitySetId() );
    const es = createEntitySet(registry, 50, [11] );
        
    const added = await cb.addComponent(es, com);

    reportUpdates( t, es, 0, 1, 0, 1, 0, 0 );
    t.ok( Component.isComponent(added) );

    } catch(err){ log.error('test error: %s', err.stack); }
    t.end();
});


test('updating an existing component', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const com = createComponent( {'@e':11, '@es':50, '@s':5} );
        const es = createEntitySet(registry, 50, [11], [com] );
        

        return cb.addComponent( es, com )
            .then( added => {
                reportUpdates( t, es, 0, 1, 0, 0, 1, 0 );
                // t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated' );
                // t.equal( es.componentsUpdated.length, 1, 'one component should be updated' );
                t.ok( Component.isComponent(added) );
            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('adding an entity with multiple components', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const coms = createComponent({tag:'soft','@s':3},{tag:'hard','@s':10});
        const es = createEntitySet(registry,60);
        const e = registry.createEntity();
        
        //add created coms to created entity
        _.each( coms, com => e.addComponent(com) );

        return cb.addEntity( es, e)
            .then( added => reportUpdates(t, es, 1, 0, 0, 2, 0, 0) )
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) ) 
});

test('updating an entity with a new component', async t => {
    try{ 
        const registry = await initialiseRegistry();
        const cb = new CmdBuffer();
        const coms = createComponent({tag:'soft','@s':3},{tag:'hard','@s':10});

        const es = createEntitySet(registry, 62, [10], [coms[1]] );
        // logEvents(es);
        const e = registry.createEntityWithId(10,62);

        coms.forEach( com => e.addComponent(com) );

        // Log.debug(`entity ids`, e.id, e.getEntityId(), e.getEntitySetId(), entityToString(e) );

        const added = await cb.addEntity( es, e );
        
        reportUpdates( t, es, 0, 1, 0, 1, 1, 0 );
        
    } catch(err){ log.error('test error: %s', err.stack) }
    t.end();
});


test('removing a component from an entity', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const coms = createComponent({tag:'soft','@s':4},{tag:'hard','@s':10},{tag:'kik','@s':13});

        const es = createEntitySet(registry,63, [12], coms );
        const e = registry.createEntityWithId(12,63);
        
        _.each( coms, com => e.addComponent(com) );
        
        return cb.removeComponent( es, coms[1] )
            .then( added => {
                reportUpdates( t, es, 0, 1, 0, 0, 0, 1 );
            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('removing the last component from an entity', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const com = createComponent({tag:'soft','@s':4});

        const es = createEntitySet(registry,63, [12], [com]);
        const e = registry.createEntityWithId(12,63);
        
        
        e.addComponent(com);

        es.getEntity = function(entityId){
            e.hasComponent = (cIId) => true;
            return Promise.resolve(e);
        }

        return cb.removeComponent( es, com )
            .then( added => {
                reportUpdates( t, es, 0, 0, 1, 0, 0, 1 );
            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});



test('removing all components from an entity', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const coms = createComponent({tag:'soft','@s':4},{tag:'hard','@s':10},{tag:'kik','@s':13});

        const es = createEntitySet(registry,63, [12], coms);
        const e = registry.createEntityWithId(12,63);
        
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );

        return cb.removeComponent( es, coms )
            .then( added => {
                reportUpdates( t, es, 0, 0, 1, 0, 0, 3 );
                // t.equal( es.entitiesUpdated.length, 0, 'no entities should be updated');
                // t.equal( es.entitiesRemoved.length, 1, 'one entitiy should be removed');
                // t.equal( es.componentsUpdated.length, 0, 'no components should be updated');
                // t.equal( es.componentsRemoved.length, 3, 'three components should be removed');
            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});


test('removing an existing entity', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const coms = createComponent({tag:'soft','@s':4},{tag:'hard','@s':10},{tag:'kik','@s':13});

        const es = createEntitySet(registry,64, [13], coms );
        const e = registry.createEntityWithId(13,64);
        
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );

        // es.getEntity = function(entityId){
        //     // let e = createEntity(entityId);
        //     e.hasComponent = (cIId) => true;
        //     // e.hasComponent = (cIId) => {
        //     //     return (cIId.getDefId() === 3);
        //     // };
        //     return Promise.resolve(e);
        // }

        return cb.removeEntity( es, e )
            .then( added => {
                reportUpdates( t, es, 0, 0, 1, 0, 0, 3 );
            })
        })
        .then( () => t.end() )
        .catch( err => log.error('test error: %s', err.stack) )
});

test('adding multiple', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const es = createEntitySet(registry,66);

        const data = [
            {"@e":1, "@c": "/component/channel", '@s':1, "name":"ecs" },
            {"@e":1, "@c": "/component/topic", '@s':2, "topic": "Entity Component Systems" },
            {"@e":5, "@c": "/component/username", '@s':3, "username":"aveenendaal"},
            {"@e":5, "@c": "/component/nickname", '@s':4, "nickname":"alex"},
            {"@e":12, "@c": "/component/channel_member", '@s':5, "channel": 1, "client": 5 },
        ];

        let entities = registry.createEntitySet({'@e':data});
        // printE( entities );
        // let entities = loadEntities( registry, data );
        
        return cb.addEntity( es, entities.models )
            .then( added => {
                reportUpdates( t, es, 3, 0, 0, 5, 0, 0 );
            })
            .then( () => t.end() )
    })
    .catch( err => log.error('test error: %s', err.stack) )
});



test.skip('the added component is a clone of the original', t => {
    return initialiseRegistry().then( registry => {
        const cb = new CmdBuffer();
        const es = registry.createEntitySet();

        const component = registry.createComponent({'@c':'/component/flower', colour:'blue'});

        return cb.addComponent( es, component )
            .then( added => {
                // console.log('so came back with', added);
            })

    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
})



function reportUpdates( t, es, eAdded, eUpdated, eRemoved, cAdded, cUpdated, cRemoved ){
    t.equal( eAdded, es.entitiesAdded.length, `${eAdded} entities should be added`);
    t.equal( eUpdated, es.entitiesUpdated.length,  `${eUpdated} entities should be updated`);
    t.equal( eRemoved, es.entitiesRemoved.length,  `${eRemoved} entity should be removed`);
    t.equal( cAdded, es.componentsAdded.length,  `${cAdded} components should be added`);
    t.equal( cUpdated, es.componentsUpdated.length,  `${cUpdated} components should be updated`);
    t.equal( cRemoved, es.componentsRemoved.length,  `${cRemoved} components should be removed`);
}

/**
*   Creates a Mock ES that we can assert against
*/
function createEntitySet(registry, entitySetId, entityIds, existingComponents){

    // return result;
    const existingComponentDefIds = _.compact(_.map(existingComponents, c => c.getDefId() ));


    entityIds = _.map( entityIds, id => setEntityIdFromId(id,entitySetId) );
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
                return Promise.resolve( registry.createEntityWithId(entityId) );
            }
            return Promise.resolve({});
        },
        getEntitySignatures: function( entityIds, options ){

            return new Promise( (resolve,reject) => {
                const result = _.map( entityIds, eid => {
                    eid = parseInt(eid, 10);
                    const comBf = BitField.create( existingComponentDefIds );
                    // console.log('YO', comBf.toJSON());
                    return registry.createEntity(null,{id:eid,comBf}); 
                });
                return resolve(result);
            })
        },
        getRegistry: function(){
            return registry;
        }
    }, Events );
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

    attrs = _.extend( {}, {'@s':1}, attrs );

    const result = Component.create(attrs);
    
    return result;
}
