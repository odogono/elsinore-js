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
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';
import { printAll } from '../../../src/util/print';

let test = suite('es/mem - removing');

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

    // es = await removeComponents( es, coms );
    await es.removeEntity(eid);

    assert.equal(await es.size(), 0, 'no entities should exist');
});


test('removes entities by id', async () => {
    let [, es] = await prepES(undefined, 'deps');
    // let es = createEntitySet();
    const eids = [1004,1006,1015,1017];

    await es.removeEntity( eids );

    assert.equal( getChanges(es.entChanges, ChangeSetOp.Remove), eids );
});

test.run();