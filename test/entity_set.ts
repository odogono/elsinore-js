import { assert } from 'chai';
import { createLog } from '../src/util/log';
import {ComponentRegistry, Type as ComponentRegistryT, createComponent } from '../src/component_registry';
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
    QueryStack, 
    buildAndExecute,
    popValuesOfTypeV} from '../src/query/stack';
import { Entity,
    create as createEntityInstance, 
    getComponent as getEntityComponent,
    size as entitySize, 
    isEntity} from '../src/entity';
import { EntitySet, 
    create as createEntitySet,
    size as entitySetSize,
    add as esAdd, 
    getEntity,
    getComponent,
    createEntity} from '../src/entity_set';
import { buildQueryStack, 
    buildComponentRegistry, 
    buildEntity, 
    assertHasComponents } from './util/stack';
import { getChanges, ChangeSetOp } from '../src/entity_set/change_set';
import { Token as ComponentT, fromComponentId, getComponentDefId, Component } from '../src/component';

const Log = createLog('TestEntitySet');

// require("fake-indexeddb/auto");
let registry:ComponentRegistry;
let stack:QueryStack;

describe('Entity Set (Mem)', () => {
    beforeEach( () => {
        [stack,registry] = buildComponentRegistry( ({def}) => {
            def('/component/channel', 'name');
            def('/component/status', 'status');
            def('/component/topic', 'topic');
            def('/component/username', 'username');
            def('/component/channel_member', 'channel_member' );
        });
        // Log.debug('[beforeEach]', stack.items, registry )
    })


    describe('Adding', () => {

        it('should create an entity (id)', () => {
            let es:EntitySet = createEntitySet({});
            let id = 0;

            [es, id] = createEntity(es);

            assert.isAtLeast( id, 1 );

            
        });

        it('should ignore an entity without an id', () => {
            let es = createEntitySet({});
            let e = createEntityInstance();

            es = esAdd(es, e);

            assert.equal( entitySetSize(es), 0 );

            // Log.debug('es', es);
        })

        it('should ignore an entity with an id, but without any components', () => {
            let es = createEntitySet({});
            let e = createEntityInstance(2);

            es = esAdd(es, e);

            assert.equal( entitySetSize(es), 0 );

            // Log.debug('es', e);
        })

        it('adds an entity with components', () => {
            let e:Entity;

            [stack,e] = buildEntity( stack, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            });
            
            
            assert.equal( entitySize(e), 3 );
            
            let es:EntitySet = createEntitySet({});
            
            es = esAdd( es, e );
            
            // Log.debug('es');
            
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

        it('adds a component', () => {
            // Log.debug('registry', registry);
            let com = createComponent(registry, '/component/channel', {name: 'chat'} );
            let es = createEntitySet({});

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );

            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];

            
            com = getComponent( es, cid );
            // Log.debug('es', com);

            assert.equal( com.name, 'chat' );
        });
        
        it('adds a component with an entity id', () => {
            let com = createComponent(registry, '/component/channel', {'@e':23, name: 'discussion'} );
            let es = createEntitySet({});

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );

            let e = getEntity(es, 23);

            assertHasComponents( registry, e, ['/component/channel'] );

            com = getEntityComponent( e, getComponentDefId(com) );

            assert.equal( com.name, 'discussion' );
        });

        it('adds a number of components of the same type', () => {
            let e:Entity;
            let coms:Component[];
            let es = createEntitySet({});

            // create a number of components
            coms = ['chat', 'dev', 'politics'].map( name => 
                createComponent(registry, '/component/channel', {name}));

            es = esAdd( es, coms );

            assert.equal( entitySetSize(es), 3 );

            // Log.debug('stack', es )
        });

        it('overwrites an entity', () => {
            let e:Entity;
            let es = createEntitySet({});

            [stack,e] = buildEntity( stack, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            }, 15);

            es = esAdd( es, e );

            assert.ok( isEntity( getEntity(es, 15)) );


            [stack,e] = buildEntity( stack, ({component}) => {
                component('/component/username', {name: 'alex'});
                component('/component/status', {status: 'inactive'});
                component('/component/channel_member', {channel: 3});
            }, 15);

            es = esAdd( es, e );

            e = getEntity(es, 15);

            assertHasComponents( registry, e, 
                ['/component/username', '/component/status', '/component/channel_member' ] );

            // Log.debug('e', es);
        });

    });


    

})
