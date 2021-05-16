import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    buildComponents,
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
    printAll,
    beforeEach,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';

let test = suite('es/mem/query - misc');

test.before.each( beforeEach );

test('selects using string compare', async () => {
    let es = createEntitySet();

    const defs = [
        { url: '/component/file', properties: ['url', 'path', 'ext'] },
    ];

    for( const def of defs ){
        await es.register(def);
    }
    
    const data = [
        { '@d': '/component/file', url: 'file:///temp/welcome.txt' },
        { '@d': '/component/file', url: 'file:///work/odgn/readme.md' }
    ]
    let coms = buildComponents(es, data);
    await es.add(coms);


    // console.log('\n');
    // printAll( es );

    const url = 'file:///temp/welcome.txt';
    const query = `[
        /component/file#url !ca "${url}" ==
        @c
    ] select`;

    const ents = await es.queryEntities(query);

    // log('result');
    // printAll( es, ents );

    assert.equal( ents.length, 1 );

});



test.run();



const log = (...args) => console.log('[es/mem/query/misc]', ...args);