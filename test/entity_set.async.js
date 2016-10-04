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
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet( createOptions );
     
        t.ok( entitySet.isEntitySet, 'it is an entitySet' );
        t.ok( entitySet.isAsync, 'it is async' );
        t.equals( entitySet.type, 'AsyncEntitySet' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test.only('adding an entity with a component returns the added entity', t => {
    return initialiseAll(createOptions).then( ([registry,entitySet]) => {

        console.log('adding to es', entitySet.id );
        logEvents( entitySet );
        const entity = registry.createEntity( [{'@c':'/component/position', x:2, y:-2}]);
        
        
        return entitySet.addEntity(entity)
            .then( added => {
                console.log('added');
                printE( entitySet );
            })

        // printE( entitySet );

        // t.ok( entity.getEntityId() > 0, 'the entity should have an id' );
        // t.ok( entitySet.hasEntity(entity.id), 'the entity should exist');
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )

});

function initialiseAll(options){
    return initialiseRegistry().then( registry => {
        return registry.createEntitySet(options)
            .then( es => [registry,es] );
    })
}