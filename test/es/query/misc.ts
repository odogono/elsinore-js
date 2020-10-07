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
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';

let test = suite('es/mem/query - misc');


test('selects using string compare', async () => {
    let es = createEntitySet();

    const defs = [
        { uri: '/component/file', properties: ['uri', 'path', 'ext'] },
    ];

    await defs.reduce( (p,def) => p.then( () => es.register(def)), Promise.resolve() );

    const data = [
        { '@d': '/component/file', uri: 'file:///temp/welcome.txt' },
        { '@d': '/component/file', uri: 'file:///work/odgn/readme.md' }
    ]
    let coms = buildComponents(es, data);
    await es.add(coms);


    console.log('\n');
    // printAll( es );

    const uri = 'file:///temp/welcome.txt';
    const query = `[
        /component/file#uri !ca "${uri}" ==
        @c
    ] select`;

    const ents = await es.queryEntities(query);

    // log('result');
    // printAll( es, ents );

    assert.equal( ents.length, 1 );

});


test.run();



const log = (...args) => console.log('[es/mem/query/misc]', ...args);