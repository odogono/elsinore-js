if( process.env.JS_ENV !== 'browser' ){
    require('fake-indexeddb/auto');
} else {
    (mocha.checkLeaks as any)(false);
}
import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenizeString } from '../../src/query/tokenizer';
import { 
    // EntitySet, 
    EntitySetIDB,
    create as createEntitySet,
    register,
    size as entitySetSize,
    add as esAdd, 
    createComponent, 
    removeComponent,
    removeComponents, 
    removeEntity,
    getEntity,
    // getComponent,
    // getComponents as esGetComponents,
    // getEntities as esGetEntities,
    getComponentDefs,
    createEntity,
    clearIDB,
    getComponent,
} from '../../src/entity_set_idb';
import {
    create as createStack,
    SType,
    addWords,
    pushValues,
    QueryStack,
    StackValue,
    push, pop,
    find as findValue,

} from '../../src/query/stack';
import {     
    getByUri, getByHash, getByDefId, resolveComponentDefIds,
} from '../../src/entity_set/registry';
import {
    onSwap, onArrayOpen, 
    onAddArray, 
    onArraySpread,
    onAdd, onConcat, onMapOpen, 
    onEntity,
    onArgError,
    onComponentDef, onComponent, 
    onEntitySet, onAddComponentToEntity,
    onMap,
    onReduce,
    onFilter,
    onClear,
    onValue,
    onDefine,
    onAddToEntitySet,
    onAssertType,
    unpackStackValue,
    onBuildMap,
    onSelect,
    unpackStackValueR,
    onDup,
    fetchComponentDef,
    onPrint,
    onDrop,
    onPluck,
    onFetchArray,
    onUnexpectedError,
    onUnique
} from '../../src/query/words';
import {
    stackToString,
} from '../../src/query/util';
import { Entity,
    create as createEntityInstance, 
    getComponent as getEntityComponent,
    addComponent as addComponentToEntity,
    size as entitySize, 
    isEntity,
    EntityList} from '../../src/entity';
import { BuildQueryFn } from '../../src/query/build';
import { isComponentDef, hash as hashDef, ComponentDef } from '../../src/component_def';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { assertHasComponents } from '../util/assert';
import { getComponentDefId, Component } from '../../src/component';

const Log = createLog('TestEntitySetIDB');

// require("fake-indexeddb/auto");
// let registry:ComponentRegistry;
// let stack:QueryStack;

describe('Entity Set (IndexedDB)', () => {

    beforeEach( async () => {
        await clearIDB();
    })

    describe('registering component defs', () => {

        it('registers', async () => {
            let def;
            let es = createEntitySet({});
            const data = { uri: '/component/position', properties:[ {name:'rank',type:'integer'}, 'file' ] };
    
            [es, def] = await register( es, data );

            // Log.debug('es', es);

            [es,def] = await register( es, "/component/piece/king" );
            [es,def] = await register( es, "/component/piece/queen" );

            def = getByUri(es, '/component/position');

            assert.ok( isComponentDef(def) );

            def = getByHash(es, hashDef(def) );

            assert.equal( def.uri, '/component/position' );
        })

    });

    describe('Adding', () => {

        it('should create an entity (id)', async () => {
            let es = createEntitySet({});
            let id = 0;

            [es, id] = await createEntity(es);

            assert.isAtLeast( id, 1 );
        });

        it('should ignore an entity without an id', async () => {
            let es = createEntitySet({});
            let e = createEntityInstance();
            let def:ComponentDef;

            [es, def] = await register( es, "/component/piece/king" );
            [es,def] = await register( es, "/component/piece/queen" );

            // let com = createComponent( es as any, def )

            // await markComponentAdd( es, com );
            // es = await addComponents( es, [com] );
            es = await esAdd(es, e);
            
            // com = await getComponent( es, '[0,1]' );
            
            assert.equal( await entitySetSize(es), 0 );

            // Log.debug('com', com );
            // Log.debug('es', es );
            // assert.equal( entitySetSize(es), 0 );
        });

        it('should ignore an entity with an id, but without any components', async () => {
            let es = createEntitySet({});
            let e = createEntityInstance(2);

            es = await esAdd(es, e);

            assert.equal( await entitySetSize(es), 0 );

            // Log.debug('es', e);
        });

        it('adds an entity with components', async () => {
            let e:Entity;
            let [es, buildEntity] = await buildEntitySet();

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            });
            
            // Log.debug('ok!', e );

            assert.equal( entitySize(e), 3 );
            
            es = await esAdd( es, e );
            
            // Log.debug('es');
            
            assert.equal( await entitySetSize(es), 1 );
            
            // get the entity added changes to find the entity id
            const [eid] = getChanges( es.entChanges, ChangeSetOp.Add );
            
            e = await getEntity( es, eid );

            // Log.debug( e );

            assertHasComponents(
                es,
                e,
                ["/component/channel", "/component/status", "/component/topic"]
            );
        });

        it('adds a component', async () => {
            // Log.debug('registry', registry);
            let [es] = await buildEntitySet();
            let com = createComponent(es, '/component/channel', {name: 'chat'} );

            es = await esAdd( es, com );

            assert.equal( await entitySetSize(es), 1 );

            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];

            
            com = await getComponent( es, cid );
            // Log.debug('es', com);

            assert.equal( com.name, 'chat' );
        });

        it('adds a component with an entity id', async () => {
            let [es] = await buildEntitySet();
            let com = createComponent(es, '/component/channel', {'@e':23, name: 'discussion'} );

            es = await esAdd( es, com );

            assert.equal( await entitySetSize(es), 1 );

            let e = await getEntity(es, 23);

            // Log.debug( e );

            assertHasComponents( es, e, ['/component/channel'] );

            com = getEntityComponent( e, getComponentDefId(com) );

            assert.equal( com.name, 'discussion' );
        });

        it('adds a number of components of the same type', async () => {
            // let e:Entity;
            let coms:Component[];
            let [es] = await buildEntitySet();

            // create a number of components
            coms = ['chat', 'dev', 'politics'].map( name => 
                createComponent(es, '/component/channel', {name}));

            es = await esAdd( es, coms );

            assert.equal( await entitySetSize(es), 3 );

            // Log.debug('stack', es )
        });

        it('overwrites an entity', async () => {
            let e:Entity;
            let [es, buildEntity] = await buildEntitySet();

            await register( es, // component def is a component
                { name:'ComponentDef', uri:'/def', properties:[
                    { name:'@d', type:'integer' },
                    { name:'uri', type:'string' },
                    { name:'name' },
                    { name:'properties', type:'array' }
                ] } );

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            }, 15);

            es = await esAdd( es, e );

            e = await getEntity(es, 15);

            assert.ok( isEntity( e ) );

            e = buildEntity( es, ({component}) => {
                component('/component/username', {name: 'alex'});
                component('/component/status', {status: 'inactive'});
                component('/component/channel_member', {channel: 3});
            }, 15);

            es = await esAdd( es, e );

            e = await getEntity(es, 15);

            assertHasComponents( es, e, 
                ['/component/username', '/component/status', '/component/channel_member' ] );

            const did = resolveComponentDefIds(es, ['/component/channel_member']).toValues()[0];
            let com = getEntityComponent(e, did)
            assert.equal( com.channel, 3 );
            // Log.debug('e', com);
        });

    });

    describe('Removing', () => {
        it('removes a component', async () => {
            let [es] = await buildEntitySet();
            let com = createComponent(es, '/component/channel', {name: 'chat'} );
            
            es = await esAdd( es, com );

            assert.equal( await entitySetSize(es), 1 );
            
            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];
            
            es = await removeComponent( es, cid );

            // Log.debug('es', es);
            
            assert.equal( await entitySetSize(es), 0 );

        });
        
        it('removes an entity and all its components', async () => {
            let e:Entity;
            let [es, buildEntity] = await buildEntitySet();

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            }, 15);

            es = await esAdd( es, e );

            const eid = getChanges( es.entChanges, ChangeSetOp.Add )[0];

            assert.exists( eid, 'entity should have been added' );

            // const ae = await getEntity(es,eid);
            // let coms = Array.from( ae.components.values() ).slice(0,2)
            // Log.debug('added e', coms );
            
            // es = await removeComponents( es, coms );
            es = await removeEntity( es, eid );
            
            assert.equal( await entitySetSize(es), 0, 'no entities should exist' );
        });
    });

    

});

async function buildEntitySet(): Promise<[EntitySetIDB,Function]> {
    let es = createEntitySet();

    const defs = [
        { uri: '/component/channel', properties:[ 'name'] },
        { uri: '/component/status', properties:[ 'status'] },
        { uri: '/component/topic', properties:[ 'topic'] },
        { uri: '/component/username', properties:[ 'username'] },
        { uri: '/component/channel_member', properties:[ 'channel'] },
    ]

    es = await defs.reduce( (prev, dspec) => 
        prev.then( async es => {
            [es] = await register(es, dspec);
            return es;
        })
    , Promise.resolve(es) );

    const buildEntity = (es:EntitySetIDB, buildFn:BuildQueryFn, eid:number = 0 ) => {
        let e = createEntityInstance(eid);
        const component = (uri:string, props:object) => {
            let def = getByUri(es, uri);
            let com = createComponent( es as any, def, props );
            e = addComponentToEntity(e, com);
        };

        buildFn( {component} );
        return e;
    }

    return [es, buildEntity];
}
