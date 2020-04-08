import { assert } from 'chai';
import 'fake-indexeddb/auto';
import { createLog } from '../src/util/log';
import {ComponentRegistry, Type as ComponentRegistryT, createComponent } from '../src/component_registry';
import {  
    pushValues,
    peekV as peekQueryStack,
    findV,
    QueryStack,
    StackValue
} from '../src/query/stack';
import { Entity,
    create as createEntityInstance, 
    getComponent as getEntityComponent,
    size as entitySize, 
    isEntity,
    EntityList} from '../src/entity';
import { ComponentList, getComponentEntityId } from '../src/component';
import { 
    // EntitySet, 
    create as createEntitySet,
    register,
    getByUri,
    // size as entitySetSize,
    // add as esAdd, 
    // removeComponent, 
    // getEntity,
    // getComponent,
    // getComponents as esGetComponents,
    // getEntities as esGetEntities,
    // query as esQuery,
    createEntity,
    // EntitySetMem,
    // ESQuery,
    // compileQueryPart
} from '../src/entity_set_idb';
import { buildQueryStack, 
    buildComponentRegistry, 
    buildEntity, 
    assertHasComponents, 
    prepareFixture} from './util/stack';
import { getChanges, ChangeSetOp } from '../src/entity_set/change_set';
import { Type as ComponentT, fromComponentId, getComponentDefId, Component } from '../src/component';
import { VL } from '../src/query/insts/value';

const Log = createLog('TestEntitySetIDB');

// require("fake-indexeddb/auto");
let registry:ComponentRegistry;
let stack:QueryStack;

describe('Entity Set (IndexedDB)', () => {

    describe('registering component defs', () => {

        it.only('registers', async () => {
            let def;
            let es = createEntitySet({});
            const data = { uri: '/component/position', properties:[ {name:'rank',type:'integer'}, 'file' ] };
    
            [es, def] = await register( es, data );

            [es,def] = await register( es, "/component/piece/king" );
            [es,def] = await register( es, "/component/piece/queen" );

            def = await getByUri(es, '/component/piece/poop');

            // Log.debug('great', es);
        })

    });

    describe('Adding', () => {

        it('should create an entity (id)', async () => {
            let es = createEntitySet({});
            let id = 0;

            [es, id] = await createEntity(es);

            assert.isAtLeast( id, 1 );

            Log.debug(es);
        });

    });
});