import { assert } from 'chai';
import { createLog } from '../../src/util/log';

import { Entity,
    create as createEntityInstance, 
    getComponent as getEntityComponent,
    size as entitySize, 
    isEntity,
    addComponentUnsafe
} from '../../src/entity';

import { assertHasComponents } from '../util/assert';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';
import { isComponentDef, hash as hashDef, getDefId, Type } from '../../src/component_def';
import { BuildQueryFn } from '../../src/query/build';
// import { EntitySetMem, EntitySet } from '../../src/entity_set/types';
import { EntitySet, EntitySetMem } from '../../src/entity_set';
import {
    toValues as bfToValues
} from '../../src/util/bitfield';

const Log = createLog('TestEntitySet');

const createEntitySet = () => new EntitySetMem();

describe('Entity Set (Mem)', () => {
    
    describe('Component Defs', () => {
        it('registers', async () => {
            let def;
            let es = createEntitySet();
            const data = { uri: '/component/position', properties: [{ name: 'rank', type: 'integer' }, 'file'] };
            // Log.debug('ok', (Date.now()-start));
            
            def = await es.register(data);

            // Log.debug('ok', (Date.now()-start));

            def = await es.register("/component/piece/king");
            def = await es.register("/component/piece/queen");

            def = es.getByUri('/component/position');

            assert.ok(isComponentDef(def));

            def = es.getByHash(hashDef(def));

            assert.equal(def.uri, '/component/position');
        })
    })


    describe('Adding', () => {

        it('should create an entity (id)', async () => {
            let es = createEntitySet();
            let id = 0;

            id = es.createEntity();

            assert.isAtLeast(id, 1);
        });

        it('should ignore an entity without an id', async () => {
            let es = new EntitySetMem();
            let e = createEntityInstance();

            es.add(e);

            assert.equal( await es.size(), 0 );
        })

        it('should ignore an entity with an id, but without any components', async () => {
            let es = createEntitySet();
            let e = createEntityInstance(2);

            await es.add(e);

            assert.equal(await es.size(), 0);
        });

        it('adds an entity with components', async () => {
            let e: Entity;
            let [es, buildEntity] = await buildEntitySet();

            e = buildEntity(es, ({ component }) => {
                component('/component/channel', { name: 'chat' });
                component('/component/status', { status: 'inactive' });
                component('/component/topic', { topic: 'data-structures' });
            });

            // Log.debug('ok!', e );

            assert.equal(entitySize(e), 3);

            await es.add(e);

            // Log.debug('es', es);

            assert.equal(await es.size(), 1);

            // get the entity added changes to find the entity id
            const [eid] = getChanges(es.entChanges, ChangeSetOp.Add);

            e = await es.getEntity(eid);

            // Log.debug( e );

            assertHasComponents(
                es,
                e,
                ["/component/channel", "/component/status", "/component/topic"]
            );
        });

        it('adds a component', async () => {
            let [es] = await buildEntitySet();
            let com = es.createComponent('/component/channel', {name: 'chat'} );

            await es.add( com );

            assert.equal( await es.size(), 1 );

            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];

            com = await es.getComponent( cid );
            // Log.debug('es', com);

            assert.equal( com.name, 'chat' );
        });
        
        it('adds a component', async () => {
            // Log.debug('registry', registry);
            let [es] = await buildEntitySet();
            let com = es.createComponent('/component/channel', { name: 'chat' });

            await es.add(com);

            assert.equal(await es.size(), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];


            com = await es.getComponent(cid);
            // Log.debug('es', com);

            assert.equal(com.name, 'chat');
        });

        it('updates a component', async () => {
            // Log.debug('registry', registry);
            let [es] = await buildEntitySet();
            let com = es.createComponent('/component/channel', { name: 'chat' });

            await es.add(com);

            assert.equal(await es.size(), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            com = await es.getComponent(cid);

            com.name = 'chat and laughter';

            es = await es.add(com);

            com = await es.getComponent(cid);

            assert.equal(com.name, 'chat and laughter');
        });

        it('adds a component with an entity id', async () => {
            let [es] = await buildEntitySet();
            let com = es.createComponent('/component/channel', { '@e': 23, name: 'discussion' });

            await es.add(com);

            assert.equal(await es.size(), 1);

            let e = await es.getEntity(23);

            // Log.debug( e );

            assertHasComponents(es, e, ['/component/channel']);

            com = getEntityComponent(e, getComponentDefId(com));

            assert.equal(com.name, 'discussion');
        });

        it('adds a single entity from two different components', async () => {
            let [es] = await buildEntitySet();
            let coms = [
                es.createComponent('/component/channel', { name: 'discussion' }),
                es.createComponent('/component/status', { status: 'active' })
            ];

            await es.add(coms);
            assert.equal(await es.size(), 1);
        });

        it('adds a number of components of the same type', async () => {
            // let e:Entity;
            let coms: Component[];
            let [es] = await buildEntitySet();

            // create a number of components
            coms = ['chat', 'dev', 'politics'].map(name =>
                es.createComponent('/component/channel', { name }));

            await es.add(coms);

            assert.equal(await es.size(), 3);

            // Log.debug('stack', es )
        });

        it('overwrites an entity', async () => {
            let e: Entity;
            let [es, buildEntity] = await buildEntitySet();

            e = buildEntity(es, ({ component }) => {
                component('/component/channel', { name: 'chat' });
                component('/component/status', { status: 'inactive' });
                component('/component/topic', { topic: 'data-structures' });
            }, 15);


            await es.add(e);

            e = await es.getEntity(15);

            // Log.debug('e', es.comChanges );// getChanges(es.comChanges) );

            assert.ok(isEntity(e));

            e = buildEntity(es, ({ component }) => {
                component('/component/username', { name: 'alex' });
                component('/component/status', { status: 'inactive' });
                component('/component/channel_member', { channel: 3 });
            }, 15);

            // Log.debug('>----');

            await es.add(e);

            e = await es.getEntity(15);

            // Log.debug('e', es.entChanges, es.comChanges);

            assertHasComponents(es, e,
                ['/component/username', '/component/status', '/component/channel_member']);

            const did = bfToValues(es.resolveComponentDefIds( ['/component/channel_member']))[0];
            let com = getEntityComponent(e, did)
            assert.equal(com.channel, 3);
            // Log.debug('e', com);
        });

        it('updates an entity', async () => {
            let [es] = await buildEntitySet();

            let com: OrphanComponent = { "@d": "/component/topic", topic: 'chat' };

            await es.add(com);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            com = await es.getComponent(cid);

            com = { ...com, topic: 'discussion' };

            // Log.debug('🦄', 'updating here');

            await es.add(com);

            com = await es.getComponent(cid);

            // Log.debug('final com', com );

            assert.equal(com.topic, 'discussion');
        });

    });


    describe('Removing', () => {
        it('removes a component', async () => {
            let [es] = await buildEntitySet();
            let com = es.createComponent('/component/channel', { name: 'chat' });

            await es.add(com);

            assert.equal(await es.size(), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            await es.removeComponent(cid);

            // Log.debug('es', es);

            assert.equal(await es.size(), 0);

        });

        it('removes an entity and all its components', async () => {
            let e: Entity;
            let [es, buildEntity] = await buildEntitySet();

            e = buildEntity(es, ({ component }) => {
                component('/component/channel', { name: 'chat' });
                component('/component/status', { status: 'inactive' });
                component('/component/topic', { topic: 'data-structures' });
            }, 15);

            await es.add(e);

            const eid = getChanges(es.entChanges, ChangeSetOp.Add)[0];

            assert.exists(eid, 'entity should have been added');

            // const ae = await es.getEntity(id);
            // let coms = Array.from( ae.components.values() ).slice(0,2)
            // Log.debug('added e', coms );

            // es = await removeComponents( es, coms );
            await es.removeEntity(eid);

            assert.equal(await es.size(), 0, 'no entities should exist');
        });
    });

})

async function buildEntitySet(options?): Promise<[EntitySetMem, Function]> {
    let es = new EntitySetMem(options);

    const defs = [
        { uri: '/component/channel', properties: ['name'] },
        { uri: '/component/status', properties: ['status'] },
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/username', properties: ['username'] },
        { uri: '/component/channel_member', properties: ['channel_member'] },
    ]

    await defs.reduce( (p,def) => p.then( () => es.register(def)), Promise.resolve() );


    const buildEntity = (es: EntitySet, buildFn: BuildQueryFn, eid: number = 0) => {
        let e = createEntityInstance(eid);
        const component = (uri: string, props: object) => {
            let def = es.getByUri(uri);
            let com = es.createComponent(def, props);
            es.addComponentToEntity(e, com, getDefId(def));
        };

        buildFn({ component });
        return e;
    }

    return [es, buildEntity];
}

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