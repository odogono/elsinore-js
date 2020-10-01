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
    hashDef,
    isComponentDef,
    isEntity,
    Log,
    OrphanComponent,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';

let test = suite('es/mem - component def');


test('registers', async () => {
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
});

test('registers same uri, but different properties', async () => {
    // in effect, the def is overwritten, but existing components are retained

    let es = createEntitySet();
    await es.register("/component/position");

    let e = es.createEntity();
    e.Position = {};
    await es.add( e );

    // no-op
    await es.register("/component/position");
    
    // different, so registered
    await es.register({uri: '/component/position', properties: ['rank', 'file']});
    
    e = es.createEntity();
    e.Position = {rank:'2', file:'b'};
    await es.add(e);

    assert.equal( await es.size(), 2 );

    const defs = await es.getComponentDefs();

    assert.equal( defs.length, 2 );

    // console.log( es );
});


test.run();