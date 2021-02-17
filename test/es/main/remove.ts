import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    buildEntitySet,
    ChangeSetOp,
    createEntitySet,
    Component,
    Entity,
    EntitySet,
    EntitySetInst,
    getChanges,
    getComponentDefId,
    isEntity,
    Log,
    OrphanComponent,
    prepES,
    ilog,
    beforeEach,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';
import { printAll } from '../../../src/util/print';
import { setEntityId, toComponentId } from '../../../src/component';

let test = suite('es/mem - removing');

test.before.each( beforeEach );

test('removes a component', async () => {
    let [es] = await buildEntitySet();
    let com = es.createComponent('/component/channel', { name: 'chat' });

    await es.add(com);

    assert.equal(await es.size(), 1);

    const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

    await es.removeComponent(cid);

    // Log.debug('es', es);

    assert.equal(await es.size(), 0);
});



test('removes an entity and all its components', async () => {
    let e: Entity;
    let [es, buildEntity] = await buildEntitySet();

    e = buildEntity(es, ({ component }) => {
        component('/component/channel', { name: 'chat' });
        component('/component/status', { status: 'inactive' });
        component('/component/topic', { topic: 'data-structures' });
    }, 15);

    await es.add(e);

    const eid = getChanges(es.entChanges, ChangeSetOp.Add)[0];

    assert.ok(eid, 'entity should have been added');

    // const ae = await es.getEntity(id);
    // let coms = Array.from( ae.components.values() ).slice(0,2)
    // Log.debug('added e', coms );

    // log('removing >');
    await es.removeEntity(eid);

    assert.equal(await es.size(), 0, 'no entities should exist');

    let com = es.createComponent('/component/channel', { '@e':23, name: 'news' });

    // log('adding >');

    await es.add(com);

    assert.equal( await es.size(), 1);

    // ilog( es );
});


test('removes entities by id', async () => {
    let [, es] = await prepES(undefined, 'deps');
    // let es = createEntitySet();
    const eids = [1004,1006,1015,1017];

    await es.removeEntity( eids );

    assert.equal( getChanges(es.entChanges, ChangeSetOp.Remove), eids );
});

test('removes components by id', async () => {
    let [, es] = await prepES(undefined, 'todo');

    const cids = [ toComponentId(100,1), toComponentId(104,3) ];

    await es.removeComponents( cids );
    
    // log( es );
    assert.equal( getChanges( es.comChanges, ChangeSetOp.Remove), cids);
    assert.equal( getChanges( es.entChanges, ChangeSetOp.Update), [100,104] );
});

test('remove with retain', async () => {
    let [, es] = await prepES(undefined, 'todo');

    await es.removeComponents( [ toComponentId(100,1) ] );

    let com = es.createComponent( '/component/title', {text:'start the day'} );
    com = setEntityId(com, 100);

    // we are adding a component that was previously removed,
    // so it becomes an update
    await es.add( com, {retain:true} );

    assert.equal( getChanges( es.comChanges, ChangeSetOp.Update), [toComponentId(100,1)] );
    assert.equal( getChanges( es.entChanges, ChangeSetOp.Update), [100] );
});



test.run();


const log = (...args) => console.log('[es/mem - removing]', ...args);