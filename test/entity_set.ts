import { assert } from 'chai';
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
import { EntitySet, 
    create as createEntitySet,
    size as entitySetSize,
    add as esAdd, 
    removeComponent, 
    getEntity,
    getComponent,
    getComponents as esGetComponents,
    getEntities as esGetEntities,
    query as esQuery,
    createEntity,
    EntitySetMem} from '../src/entity_set';
import { buildQueryStack, 
    buildComponentRegistry, 
    buildEntity, 
    assertHasComponents, 
    prepareFixture} from './util/stack';
import { getChanges, ChangeSetOp } from '../src/entity_set/change_set';
import { Type as ComponentT, fromComponentId, getComponentDefId, Component } from '../src/component';

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
            let es = createEntitySet({});
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
            
            let es = createEntitySet();
            
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


    describe('Removing', () => {
        it('removes a component', () => {
            let com = createComponent(registry, '/component/channel', {name: 'chat'} );
            let es = createEntitySet({});

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );
            
            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];
            
            es = removeComponent( es, cid );

            // Log.debug('es', es);
            
            assert.equal( entitySetSize(es), 0 );

        });
        it('removes an entity and all its components', () => {});
    });

    describe('Query', () => {

        let es:EntitySet;
        let registry:ComponentRegistry;

        beforeEach( async () => {
            [,registry,es] = await prepareFixture('todo.ldjson', {addToEntitySet:true});
        })

        it('retrieves by entity id', async () => {
            // Log.debug('stack', stack.items);//, _getCallerFile() );
            // 

            let q = { '@e': 100 };
            let list = esQuery( es, registry, q ) as EntityList;

            // Log.debug('result', list);

            assert.include( list.entityIds, 100 );
            // entity id
        })

        it('retrieves components by def id', async () => {
            // returns all components that match
            let q = {'@c': '/component/completed' };
            let list = esQuery( es, registry, q ) as ComponentList;

            // Log.debug('es', es);
            let coms = esGetComponents( es, list );
            
            // Log.debug('result', coms);

            assert.equal( coms.length, 3 );
            assert.ok( coms.reduce( (v,c) => v && 'isComplete' in c.attributes, true ) );

            // [ value (component), entityId ]
            // componentlist ( [entityId,defId] )
        })

        it('retrieves entities by def id', async () => {
            // returns all entities that have this component
            let q = {'@e': '/component/completed' };
            let list = esQuery( es, registry, q ) as EntityList;

            
            let e = esGetEntities( es, list );
            
            assert.equal( e.length, 3 );
            // [ value (entityId) ]
            // entitylist [ eid, ... ]
        })

        it.only('retrieves entity by id and def id', async () => {
            // returns component on entity 101
            // the trick here is that this is a two pass op.
            // first the entity is selected, then the component
            // the result is a componentlist because of the component
            let q = { '@e':101, '@c': '/component/completed' };
            let list = esQuery( es, registry, q ) as ComponentList;
            
            // Log.debug('result', es);
            
            let coms = esGetComponents( es, list );
            
            Log.debug('result', coms);

            assert.equal( getComponentEntityId( coms[0] ), 101 );
        })

        it('retrieves entities by def id', async () => {
            // returns entities which have the components
            // {"@e": ['/component/completed','/component/priority'] },
            // entitylist - [ eid, ... ]
        })

        it('retrieves component attributes', async () => {
            // returns the values of text on the component
            // { '@at':'/component/title#text' },
            // return [value, [eid,did],attr]  tuple [ value, entityid, defid, attrName ]
            // [ 'drink some tea', {'@e':103, '@c':'/component/title, '@at':'text'} ]
            // "drink some tea", { '@at':'/component/title#text' }, '=='
            // exists? value|undefined
            // "drink some tea", { '@c':'/component/title#text' }, '=='
            // componentlist [ [eid,did], ... ]
            // true, { '@e':'/component/completed#isComplete' }, '=='
            // entitylist? 
        })

    })

})


// https://stackoverflow.com/a/29581862
function _getCallerFile() {
    var originalFunc = Error.prepareStackTrace;

    var callerfile;
    try {
        var err = new Error();
        var currentfile;

        Error.prepareStackTrace = function (err, stack) { return stack; };

        // let stack:string[] = err.stack as any;
        let entry = (err.stack as any).shift();
        // console.log('eNtRy', entry.getFunctionName());
        currentfile = entry.getFileName();

        while (err.stack.length) {
            entry = (err.stack as any).shift();
            // console.log('eNtRy', entry.getFunctionName());
            callerfile = entry.getFileName();

            if(currentfile !== callerfile) break;
        }
    } catch (e) {}

    Error.prepareStackTrace = originalFunc; 

    return callerfile;
}