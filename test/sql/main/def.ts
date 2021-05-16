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
    beforeEach,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';

let test = suite('es/sqlite - component def');

test.before.each( beforeEach );

test('registers', async () => {
    let def;
    let es = createEntitySet();
    const data = { url: '/component/position', properties: [{ name: 'rank', type: 'integer' }, 'file'] };
    // Log.debug('ok', (Date.now()-start));
    
    def = await es.register(data);

    // Log.debug('ok', (Date.now()-start));

    def = await es.register("/component/piece/king");
    def = await es.register("/component/piece/queen");

    def = es.getByUrl('/component/position');

    assert.ok(isComponentDef(def));

    def = es.getByHash(hashDef(def));

    assert.equal(def.url, '/component/position');
});

test('registering again wont add', async () => {
    let es = createEntitySet();
    const data = { url: '/component/position', properties: [{ name: 'rank', type: 'integer' }, 'file'] };
    
    await es.register(data);

    // retain the db reference
    let db = es.db;
    es = createEntitySet({db});

    await es.register(data);

    const defs = await es.getComponentDefs();

    assert.is( defs.length, 1 );
})

test('registers same url, but different properties', async () => {
    // in effect, the def is overwritten, but existing components are retained

    let es = createEntitySet();
    await es.register("/component/position");

    let e = es.createEntity();
    e.Position = {};
    await es.add( e );

    // no-op
    await es.register("/component/position");
    
    // different, so registered
    await es.register({url: '/component/position', properties: ['rank', 'file']});
    
    e = es.createEntity();
    e.Position = {rank:'2', file:'b'};
    await es.add(e);

    assert.equal( await es.size(), 2 );

    const defs = await es.getComponentDefs();

    assert.equal( defs.length, 2 );

    // console.log( es );
});


test.run();