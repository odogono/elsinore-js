import { assert } from 'chai';
import { createLog } from '../src/util/log';
import {ComponentRegistry, Type as ComponentRegistryT } from '../src/component_registry';
import {  
    execute as executeQueryStack,
    pushV as pushQueryStack,
    peekV as peekQueryStack,
    buildAndExecute as buildQuery,
    findV,
    unshiftV,
    addInstruction,
    InstDef,
    BuildQueryFn,
    BuildQueryParams,
    QueryStack } from '../src/query/stack';
import { Entity, 
    size as entitySize } from '../src/entity';
import { EntitySet, 
    create as createEntitySet,
    size as entitySetSize,
    add as addEntity, 
    getEntity,
    createEntity} from '../src/entity_set';
import { buildQueryStack, buildComponentRegistry, buildEntity, assertHasComponents } from './util/stack';
import { getChanges, ChangeSetOp } from '../src/entity_set/change_set';

const Log = createLog('TestEntitySet');

// require("fake-indexeddb/auto");
let registry:ComponentRegistry;
let stack:QueryStack;

describe('Entity Set (Mem)', () => {
    beforeEach( () => {
        const parts = buildComponentRegistry( ({def}) => {
            def('/component/channel', 'name');
            def('/component/status', 'status');
            def('/component/topic', 'topic');
        });
        stack = parts[0];
        registry = parts[1];
    })


    describe('Adding', () => {

        it('should create an entity (id)', () => {
            let es:EntitySet = createEntitySet({});
            let id = 0;

            [es, id] = createEntity(es);

            assert.isAtLeast( id, 1 );

            
        });

        it('should add an entity', () => {
            let e:Entity;

            [stack,e] = buildEntity( stack, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            });
            
            
            assert.equal( entitySize(e), 3 );
            
            let es:EntitySet = createEntitySet({});
            
            es = addEntity( es, e );
            
            // Log.debug('es', es );
            
            assert.equal( entitySetSize(es), 1 );
            
            // get the entity added changes to find the entity id
            const [eid] = getChanges( es.entChanges, ChangeSetOp.Add );
            
            let registry = findV( stack, ComponentRegistryT );
            e = getEntity( es, eid );

            assertHasComponents(
                registry,
                e,
                ["/component/channel", "/component/status", "/component/topic"]
            );

        });

    });


    

})
