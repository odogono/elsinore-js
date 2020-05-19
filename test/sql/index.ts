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
    removeComponent,
    removeEntity,
    getEntity,
    getComponent,
    getComponentDefs,
    createEntity,
} from '../../src/entity_set_sql';
import {
    getComponent as getEntityComponent,
    create as createEntityInstance, Entity,
    size as entitySize,
    isEntity,
    addComponentUnsafe,
} from '../../src/entity';
import {
    toObject as defToObject,
    hash as hashDef,
    isComponentDef,
    ComponentDef,
    getDefId,
} from '../../src/component_def';
import { getComponentDefId, Component, OrphanComponent } from '../../src/component';
import {
    assertHasComponents,
} from '../util/assert';
import { createLog } from "../../src/util/log";
import { sqlClear } from '../../src/entity_set_sql/sqlite';
import { BuildQueryFn } from '../../src/query/build';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { buildEntity } from '../util/stack';

const Log = createLog('TestEntitySetSQL');

// require("fake-indexeddb/auto");
// let registry:ComponentRegistry;
// let stack:QueryStack;

const liveDB = { uuid: 'test.sqlite', isMemory: false };
const testDB = { uuid: 'TEST-1', isMemory: true };

describe('Entity Set (SQL)', () => {

    beforeEach(async () => {
        await sqlClear('test.sqlite');
    })

    // describe('basic', () => {

    // });

    describe('registering component defs', () => {

        it('registers', async () => {
            let def;
            let es = createEntitySet({});
            // let es = createEntitySet({uuid:'test.sqlite', isMemory:true});
            const data = { uri: '/component/position', properties: [{ name: 'rank', type: 'integer' }, 'file'] };
            // Log.debug('es', es);

            [es, def] = register(es, data);


            [es, def] = register(es, "/component/piece/king");
            [es, def] = register(es, "/component/piece/queen");

            def = getByUri(es, '/component/position');

            assert.ok(isComponentDef(def));

            def = getByHash(es, hashDef(def));

            assert.equal(def.uri, '/component/position');

            let defs = getComponentDefs(es);

            // Log.debug('defs', defs);
        })

    });

    describe('Adding', () => {

        it('should create an entity (id)', () => {
            let es = createEntitySet({});
            let id = 0;

            [es, id] = createEntity(es);

            assert.isAtLeast(id, 1);

            // Log.debug( id );
        });

        it('should ignore an entity without an id', async () => {
            let es = createEntitySet({});
            // let es = createEntitySet({uuid:'test.sqlite', isMemory:false, debug:true});
            let e = createEntityInstance();
            let def: ComponentDef;

            [es, def] = register(es, "/component/piece/king");
            [es, def] = register(es, "/component/piece/queen");

            let com = createComponent(es as any, def)

            // markComponentAdd( es, com );
            // Log.debug('com', com);
            // Log.debug('def', def);
            // es = addComponents( es, [com] );
            // Log.debug('es', es);
            es = esAdd(es, e);

            com = getComponent(es, '[1,2]');

            assert.equal(entitySetSize(es), 0);

            // Log.debug('com', com );
            // Log.debug('es', es );
            // assert.equal( entitySetSize(es), 0 );
        });

        it('should ignore an entity with an id, but without any components', async () => {
            let es = createEntitySet({});
            let e = createEntityInstance(2);

            es = esAdd(es, e);

            assert.equal(entitySetSize(es), 0);

            // Log.debug('es', e);
        });

        it('adds an entity with components', async () => {
            let e: Entity;
            let [es, buildEntity] = buildEntitySet({ ...liveDB, debug: false });

            e = buildEntity(es, ({ component }) => {
                component('/component/channel', { name: 'chat' });
                component('/component/status', { status: 'inactive' });
                component('/component/topic', { topic: 'data-structures' });
            });

            // Log.debug('ok!', e );

            assert.equal(entitySize(e), 3);

            es = esAdd(es, e);

            // Log.debug('es', es);

            assert.equal(entitySetSize(es), 1);

            // get the entity added changes to find the entity id
            const [eid] = getChanges(es.entChanges, ChangeSetOp.Add);

            e = getEntity(es, eid);

            // Log.debug( e );

            assertHasComponents(
                es,
                e,
                ["/component/channel", "/component/status", "/component/topic"]
            );
        });



        it('adds a component', async () => {
            // Log.debug('registry', registry);
            let [es, buildEntity] = buildEntitySet({ ...liveDB, debug: false });
            let com = createComponent(es, '/component/channel', { name: 'chat' });

            es = esAdd(es, com);

            assert.equal(entitySetSize(es), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];


            com = getComponent(es, cid);
            // Log.debug('es', com);

            assert.equal(com.name, 'chat');
        });

        it('updates a component', async () => {
            // Log.debug('registry', registry);
            let [es, buildEntity] = buildEntitySet({ ...liveDB, debug: false });
            let com = createComponent(es, '/component/channel', { name: 'chat' });

            es = esAdd(es, com);

            assert.equal(entitySetSize(es), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];


            com = getComponent(es, cid);
            // Log.debug('es', com);

            com.name = 'chat and laughter';
            // Log.debug('>-----');
            es = esAdd(es, com);

            // Log.debug('es', es);

            com = getComponent(es, cid);

            assert.equal(com.name, 'chat and laughter');
        });

        it('adds a component with an entity id', () => {
            let [es] = buildEntitySet({ ...liveDB, debug: false });
            let com = createComponent(es, '/component/channel', { '@e': 23, name: 'discussion' });

            es = esAdd(es, com);

            // Log.debug('es', es.entChanges);

            assert.equal(entitySetSize(es), 1);

            let e = getEntity(es, 23);

            // Log.debug('e', e);

            assertHasComponents(es, e, ['/component/channel']);

            com = getEntityComponent(e, getComponentDefId(com));

            assert.equal(com.name, 'discussion');
        });

        it('adds a single entity from two different components', async () => {
            let [es] = buildEntitySet({ ...liveDB, debug: false });
            let coms = [
                createComponent(es, '/component/channel', { name: 'discussion' }),
                createComponent(es, '/component/status', { status: 'active' })
            ];

            es = esAdd(es, coms);
            assert.equal(entitySetSize(es), 1);
        });

        it('adds a number of components of the same type', () => {
            let e: Entity;
            let coms: Component[];
            let [es] = buildEntitySet({ ...liveDB, debug: false });

            // create a number of components
            coms = ['chat', 'dev', 'politics'].map(name =>
                createComponent(es, '/component/channel', { name }));

            es = esAdd(es, coms);

            assert.equal(entitySetSize(es), 3);

            // Log.debug('stack', es )
        });

        it('overwrites an entity', async () => {
            let e: Entity;
            let [es] = buildEntitySet({ ...liveDB, debug: false });

            e = await buildEntity(es, `
            [ /component/channel {name: 'chat'} ] !c
            [ /component/status {status: 'inactive'} ] !c
            [ /component/topic {status: 'data-structures'} ] !c
            `, 15);

            // Log.debug('noice', e);

            es = esAdd(es, e);

            assert.ok(isEntity(getEntity(es, 15)));

            e = await buildEntity(es, `
                [ /component/username {username: 'alex'}] !c
                [ /component/status {status: 'inactive'}] !c
                [ /component/channel_member {channel: 3}] !c
            `, 15);

            es = esAdd(es, e);

            // Log.debug('e', es.comChanges);

            e = getEntity(es, 15);

            assertHasComponents(es, e,
                ['/component/username', '/component/status', '/component/channel_member']);

        });

        it('updates an entity', async () => {
            let [es] = await buildEntitySet({ ...liveDB, debug: false} );

            let com:OrphanComponent = { "@d": "/component/topic", topic: 'chat' };

            es = await esAdd( es, com );

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            // Log.debug('changes', es);

            com = await getComponent(es, cid );
            
            com = {...com, topic:'discussion'};

            // Log.debug('🦄', 'updating here');
            
            es = await esAdd(es, com);

            com = await getComponent(es, cid );

            // Log.debug('final com', com );

            assert.equal( com.topic, 'discussion' );
        });
    });


    describe('Removing', () => {
        it('removes a component', () => {
            let [es] = buildEntitySet({ ...liveDB, debug: false });
            let com = createComponent(es, '/component/channel', { name: 'chat' });

            es = esAdd(es, com);

            assert.equal(entitySetSize(es), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            es = removeComponent(es, cid);

            // Log.debug('es', es);

            assert.equal(entitySetSize(es), 0);

        });

        it('removes an entity and all its components', async () => {
            let e: Entity;
            let [es] = buildEntitySet({ ...liveDB, debug: false });

            e = await buildEntity(es, `
            [ /component/channel {name: 'chat'} ] !c
            [ /component/status {status: 'inactive'} ] !c
            [ /component/topic {status: 'data-structures'} ] !c
            `, 15);

            es = esAdd(es, e);

            assert.equal(entitySetSize(es), 1);

            const eid = getChanges(es.entChanges, ChangeSetOp.Add)[0];

            assert.exists(eid, 'entity should have been added');

            es = removeEntity(es, eid);

            assert.equal(entitySetSize(es), 0);
        });
    });
});




function buildEntitySet(options): [EntitySetSQL, Function] {
    let es = createEntitySet(options);

    const defs = [
        { uri: '/component/channel', properties: ['name'] },
        { uri: '/component/status', properties: ['status'] },
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/username', properties: ['username'] },
        { uri: '/component/channel_member', properties: ['channel_member'] },
    ]

    es = defs.reduce((es, dspec) => {
        [es] = register(es, dspec);
        return es;
    }, es);

    const buildEntity = (es: EntitySetSQL, buildFn: BuildQueryFn, eid: number = 0) => {
        let e = createEntityInstance(eid);
        const component = (uri: string, props: object) => {
            let def = getByUri(es, uri);
            let com = createComponent(es as any, def, props);
            e = addComponentUnsafe(e, getDefId(def), com, def.name );
        };

        buildFn({ component });
        return e;
    }

    return [es, buildEntity];
}