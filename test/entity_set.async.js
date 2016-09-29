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

test('type of entityset', t => {
    
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet( AsyncEntitySet );
     
        t.ok( entitySet.isEntitySet, 'it is an entitySet' );
        t.ok( entitySet.isAsync, 'it is async' );
        t.equals( entitySet.type, 'AsyncEntitySet' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});