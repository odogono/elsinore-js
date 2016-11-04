import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import AsyncEntitySet from '../src/entity_set/async';
import Entity from '../src/entity';
import Component from '../src/component';
import Registry from '../src/registry';


import {
    // Component, Entity, EntityFilter,
    // Registry, SchemaRegistry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';

const createOptions = {instanceClass:AsyncEntitySet, entityIdStart:100, componentIdStart:10};

test('type of entityset', t => {
    return initialiseAll(createOptions).then( ([registry,entitySet]) => {
        t.ok( entitySet.isEntitySet, 'it is an entitySet' );
        t.ok( entitySet.isAsync, 'it is async' );
        t.equals( entitySet.type, 'AsyncEntitySet' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('adding an entity with a component returns the added entity', t => {
    return initialiseAll(createOptions).then( ([registry,entitySet]) => {

        // logEvents( entitySet );
        const entity = registry.createEntity( [{'@c':'/component/position', x:2, y:-2}]);
        
        return entitySet.addEntity(entity)
            .then( added => {
                t.equals( added.getEntitySetId(), entitySet.getEntitySetId() );
                t.equals( added.Position.get('y'), -2 );
            });
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )

});

test('adding several components without an entity adds them to the same new entity', function(t){
    const eventSpy = Sinon.spy();

    return initialiseAll(createOptions).then( ([registry,entitySet]) => {
        // logEvents( entitySet );
        entitySet.on('all', eventSpy);

        const components = registry.createComponent([
            registry.createComponent( {'@c':'/component/flower', colour:'yellow'}),
            registry.createComponent( '/component/radius', {radius:2.0, author:'alex'} )
        ]);

        t.assert( components[0].getEntityId() === undefined, 'the components do not yet have an entity id' );

        return entitySet.addComponent(components)
            .then( components => entitySet.getEntity(components[0].getEntityId()) )
            .then( entity => {
                t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
                t.assert( entity.Flower, 'the entity should have a Flower component' );
                t.assert( entity.Radius, 'the entity should have a Radius component' );
            })
        })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('removing a component from an entity with only one component', t => {
    const eventSpy = Sinon.spy();
    
    return initialiseAll(createOptions).then( ([registry,entitySet]) => {
        entitySet.on('all', eventSpy);
        const component = registry.createComponent( '/component/position', {x:15,y:2}); 

        // logEvents( entitySet );
        return entitySet.addComponent(component)
            .then( component => {
                // printE( entitySet );
                // log.debug('removed! ' + component.id );
                return component;
            })
            .then( component => entitySet.removeComponent(component) )
            // .then( () => printKeys(entitySet, '_ent_bf', {values:false} ) )
            // .then( component => entitySet.getEntity(component.getEntityId()) )
            .then( (entity) => {
                t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');
                t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');
                
            })
        })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

// console.log('WARNING - reenable this test');
test('registers existing component defs with the registry when opened', t => {
    const schemaA = { uri:'/component/channel', properties:{ name:{type:'string'} }};
    const schemaB = { uri:'/schema/alpha', properties:{ channel:{type:'string'} }};

    return initialiseAll(createOptions).then( ([registry,entitySet]) => {
        return entitySet.registerComponentDef([schemaA,schemaB])
                
                .then( () => registry.removeEntitySet(entitySet) )
                
                // .then( () => console.log('!!! creating entityset') )
                
                .then( () => registry.addEntitySet(entitySet) )
                
                .then( entitySet => {

                    // _.each( entitySet.getComponentDefs(), cd => console.log( `${cd.getUri()} ${cd.hash()}`  ));

                    // console.log('good all done', entitySet.getComponentDefs());
                    const component = registry.createComponent( '/component/name', {name:'susan'} );
                    
                    t.equal( component.get('name'), 'susan');

                    // _.each( registry.getComponentDefs(), cd => console.log( `${cd.getUri()} ${cd.hash()}`  ));
                })
    })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
})


test('returns the newest version of the schema', t => {
    // let registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
    const schemaA = { uri:'/component/channel', properties:{ name:{type:'string'} }};
    const schemaB = { uri:'/schema/alpha', properties:{ channel:{type:'string'} }};

    return initialiseAll(createOptions).then( ([registry,entitySet]) => {
            return entitySet.registerComponentDef(schemaA)
                .then( () => entitySet.registerComponentDef(schemaB) )
                .then( () => entitySet.getComponentDef('/schema/alpha') )
                .then( cDef => {
                    t.ok( cDef.getProperties().channel, 'the 2nd version is the one returned' );
                    return true;
                })
    })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});


test('adding an existing entity changes its id if it didnt originate from the entityset', t => {
    const eventSpy = Sinon.spy();
    
    return initialiseAll({'@es':205, ...createOptions}).then( ([registry,entitySet]) => {
        entitySet.on('all', eventSpy);
        const entity = registry.createEntity( { '@c':'/component/flower', colour:'white'}, {'@e':12} );
        // printE( entity );
        // logEvents( entitySet );
        return entitySet.addEntity( entity )
            .then( entity => {
                // printE( entity );
                t.notEqual( entity.getEntityId(), 12, 'the entity id will have been changed' );
                t.equal( entity.getEntitySetId(), 205, 'the entityset id will have been set' );
            })
    })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('adding an existing entity doesnt changes its id if it originated from the entityset', t => {
    const eventSpy = Sinon.spy();
    
    return initialiseAll({'@es':205, ...createOptions}).then( ([registry,entitySet]) => {
        entitySet.on('all', eventSpy);
        const entity = registry.createEntity( { '@c':'/component/flower', colour:'white'}, { '@e':12, '@es':205} );
            // logEvents( entitySet );
            // printE( entity );
        return entitySet.addEntity( entity )
            .then( entity => {
                    
                t.equal( entity.getEntitySetId(), 205, 'the entityset id will have been set' );
                t.equal( entity.getEntityId(), 12, 'the entity id will have been changed' );
            })
    })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test('adding an entity with an identical id will replace the existing one', t => {
    const eventSpy = Sinon.spy();
    
    return initialiseAll({'@es':1, ...createOptions}).then( ([registry,entitySet]) => {
        entitySet.on('all', eventSpy);
        const entityA = registry.createEntity( {'@c':'/component/position', x:0,y:0}, {'@e':45, '@es':1} );
        const entityB = registry.createEntity([
            {'@c':'/component/position', x:15,y:-90},
            {'@c':'/component/status', 'status':'active'}
        ], {'@e':45, '@es':1});

        // logEvents( entitySet );
        return entitySet.addEntity( entityA )
            // .then( () => { console.log(' ');})
            .then( () => entitySet.addEntity(entityB))
            .then( () => entitySet.getEntityById(45) )
            .then( entity => {
                // console.log(' ');
                // printE( entitySet );
                // printE( entitySet.components );
                t.equals( entity.Status.get('status'), 'active' );
                t.equals( entity.Position.get('x'), 15 );
            })
            // 
        // return entitySet.addEntity( entity )
        //     .then( entity => {
                    
        //         t.equal( entity.getEntitySetId(), 205, 'the entityset id will have been set' );
        //         t.equal( entity.getEntityId(), 12, 'the entity id will have been changed' );
        //     })
    })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

function initialiseAll(options){
    return initialiseRegistry().then( registry => {
        return registry.createEntitySet(options)
            .then( es => [registry,es] );
    })
}