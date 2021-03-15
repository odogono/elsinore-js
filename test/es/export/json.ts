import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    beforeEach,
    prepES,
} from '../helpers';


import { exportEntity, exportEntitySet } from '../../../src/util/export/json';

let test = suite('es/sqlite - get');
test.before.each(beforeEach);


test.only('export entity', async () => {
    let [, es] = await prepES(undefined, 'todo');

    let e = await es.getEntity(101);

    let result = exportEntity(es, e, { comUrl: true, comDid: false });

    // console.log( result );

    assert.equal(result, {
        id: 101,
        components: [
            { '@du': '/component/title', text: 'phone up friend' },
            { '@du': '/component/completed', isComplete: true },
            {
                '@du': '/component/meta',
                createdAt: '2020-05-24T10:15:00.000Z'
            }
        ]
    })
});


test('export entityset', async () => {
    let [, es] = await prepES(undefined, 'todo');

    let result = await exportEntitySet(es, { ents: false, defs: false, coms: true, comUrl: true });

    console.log(JSON.stringify(result, null, '\t'));
})


test.run();