import { assert } from 'chai';

import { 
    // EntitySet, 
    EntitySetSQL,
    create as createEntitySet,
    register,
    getByUri,
    getByHash,
    size as entitySetSize,
    add as esAdd, 
    createComponent, 
    // removeComponent, 
    // removeEntity,
    getEntity,
    getComponent,
    // getComponents as esGetComponents,
    // getEntities as esGetEntities,
    getComponentDefs,
    createEntity,
    // clearIDB,
    markComponentAdd,
    // getComponent,
    addComponents,
    // EntitySetMem,
    // ESQuery,
    // compileQueryPart
} from '../src/entity_set_sql';
import {
    create as createEntityInstance, Entity,
    addComponent as addComponentToEntity,
    size as entitySize,
} from '../src/entity';
import { 
    toObject as defToObject, 
    hash as hashDef, 
    isComponentDef, 
    ComponentDef, 
    Type
} from '../src/component_def';
import { ComponentRegistry } from '../src/component_registry';
import { 
    assertHasComponents, 
} from './util/assert';
import { createLog } from "../src/util/log";
import { sqlClear } from '../src/entity_set_sql/sqlite';
import { BuildQueryFn } from '../src/query/build';
import { getChanges, ChangeSetOp } from '../src/entity_set/change_set';

const Log = createLog('TestEntitySetSQL');

// require("fake-indexeddb/auto");
// let registry:ComponentRegistry;
// let stack:QueryStack;

const liveDB = {uuid:'test.sqlite', isMemory:false};

describe('Entity Set (SQL)', () => {

    beforeEach( async () => {
        await sqlClear('test.sqlite');
    })

    // describe('basic', () => {
        
    // });

    describe('registering component defs', () => {

        it('registers', async () => {
            let def;
            let es = createEntitySet({});
            // let es = createEntitySet({uuid:'test.sqlite', isMemory:true});
            const data = { uri: '/component/position', properties:[ {name:'rank',type:'integer'}, 'file' ] };
            // Log.debug('es', es);
    
            [es, def] = register( es, data );


            [es,def] = register( es, "/component/piece/king" );
            [es,def] = register( es, "/component/piece/queen" );

            def = getByUri(es, '/component/position');

            assert.ok( isComponentDef(def) );

            def = getByHash(es, hashDef(def) );

            assert.equal( def.uri, '/component/position' );

            let defs = getComponentDefs(es);

            Log.debug('defs', defs);
        })

    });

    describe('Adding', () => {

        it('should create an entity (id)', () => {
            let es = createEntitySet({});
            let id = 0;

            [es, id] = createEntity(es);

            assert.isAtLeast( id, 1 );

            // Log.debug( id );
        });

        it('should ignore an entity without an id', async () => {
            let es = createEntitySet({});
            // let es = createEntitySet({uuid:'test.sqlite', isMemory:false, debug:true});
            let e = createEntityInstance();
            let def:ComponentDef;

            [es,def] = register( es, "/component/piece/king" );
            [es,def] = register( es, "/component/piece/queen" );

            let com = createComponent( es as any, def )

            // markComponentAdd( es, com );
            // Log.debug('com', com);
            // Log.debug('def', def);
            // es = addComponents( es, [com] );
            // Log.debug('es', es);
            es = esAdd(es, e);
            
            com = getComponent( es, '[1,2]' );
            
            assert.equal( entitySetSize(es), 0 );

            // Log.debug('com', com );
            // Log.debug('es', es );
            // assert.equal( entitySetSize(es), 0 );
        });

        it('should ignore an entity with an id, but without any components', async () => {
            let es = createEntitySet({});
            let e = createEntityInstance(2);

            es = esAdd(es, e);

            assert.equal( entitySetSize(es), 0 );

            // Log.debug('es', e);
        });

        it('adds an entity with components', async () => {
            let e:Entity;
            let [es, buildEntity] = buildEntitySet({...liveDB, debug:true});

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            });
            
            // Log.debug('ok!', e );

            assert.equal( entitySize(e), 3 );
            
            es = esAdd( es, e );
            
            Log.debug('es', es);
            
            assert.equal( entitySetSize(es), 1 );
            
            // get the entity added changes to find the entity id
            const [eid] = getChanges( es.entChanges, ChangeSetOp.Add );
            
            e = getEntity( es, eid );

            // Log.debug( e );

            assertHasComponents(
                es as ComponentRegistry,
                e,
                ["/component/channel", "/component/status", "/component/topic"]
            );
        });

        it('adds a component', async () => {
            // Log.debug('registry', registry);
            let [es, buildEntity] = buildEntitySet({...liveDB, debug:true});
            let com = createComponent(es, '/component/channel', {name: 'chat'} );

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );

            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];

            
            com = getComponent( es, cid );
            // Log.debug('es', com);

            assert.equal( com.name, 'chat' );
        });
        
        it.only('updates a component', async () => {
            // Log.debug('registry', registry);
            let [es, buildEntity] = buildEntitySet({...liveDB, debug:false});
            let com = createComponent(es, '/component/channel', {name: 'chat'} );

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );

            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];

            
            com = getComponent( es, cid );
            // Log.debug('es', com);

            com.name = 'chat and laughter';
            // Log.debug('>-----');
            es = esAdd( es, com );

            Log.debug('es', es);

            com = getComponent( es, cid );

            assert.equal( com.name, 'chat and laughter' );
        });
    });
});




function buildEntitySet(options): [EntitySetSQL,Function] {
    let es = createEntitySet(options);

    const defs = [
        { uri: '/component/channel', properties:[ 'name'] },
        { uri: '/component/status', properties:[ 'status'] },
        { uri: '/component/topic', properties:[ 'topic'] },
        { uri: '/component/username', properties:[ 'username'] },
        { uri: '/component/channel_member', properties:[ 'channel_member'] },
    ]

    es = defs.reduce( (es, dspec) => {
            [es] = register(es, dspec);
            return es;
    }, es );

    const buildEntity = (es:EntitySetSQL, buildFn:BuildQueryFn, eid:number = 0 ) => {
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