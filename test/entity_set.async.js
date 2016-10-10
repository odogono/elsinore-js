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

const createOptions = {instanceClass:AsyncEntitySet};

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
    // let registry;

    return initialiseAll(createOptions).then( ([registry,entitySet]) => {
        logEvents( entitySet );
        entitySet.on('all', eventSpy);

        return entitySet.addComponent([
            registry.createComponent( '/component/flower', {colour:'yellow'}),
            registry.createComponent( '/component/radius', {radius:2.0, author:'alex'} )
            ])
            .then( components => {
                // console.log('1st com eid', components[0].getEntityId());
                // printE( entitySet, '?>' );
                return components;
            })
            .then( components => entitySet.getEntity(components[0].getEntityId()) )
            .then( entity => {
                t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
                t.assert( entity.Flower, 'the entity should have a Flower component' );
                t.assert( entity.Radius, 'the entity should have a Radius component' );
            })
            // .then( finalise(t,entitySet) )
        })
    .then( () => t.end() )
    .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
});

test.only('removing a component from an entity with only one component', t => {
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
            .then( component => entitySet.removeComponent(component, {debug:true}) )
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


test('returns the newest version of the schema', t => {
    // let registry = Common.initialiseRegistry( {loadComponents:false, logEvents:false} );
    let schemaA = { uri:'/component/channel', properties:{ name:{type:'string'} }};
    let schemaB = { uri:'/schema/alpha', properties:{ channel:{type:'string'} }};

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


function initialiseAll(options){
    return initialiseRegistry().then( registry => {
        return registry.createEntitySet(options)
            .then( es => [registry,es] );
    })
}