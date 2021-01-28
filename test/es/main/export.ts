import { suite } from 'uvu';
import assert from 'uvu/assert';
import { printAll } from '../helpers';
import { exportEntitySet } from '../../../src/util/export/insts';

import {
    createEntitySet,
    beforeEach,
    prepES,
} from '../helpers';


let test = suite('es/mem - export');

test.before.each( beforeEach );


test('should create an entity (id)', async () => {
    const Path = require('path');
    // const Fs = require('fs-extra');
    const path = Path.resolve(__dirname, `../../export.insts`);

    let [, es] = await prepES(undefined, 'todo');


    let insts = await exportEntitySet(es, {
        path, retainEid:true
    })

    console.log( insts );

    assert.equal(insts,
`[ "/component/title" [ "text" ] ] !d
[ "/component/completed" [ { "name": "isComplete" "type": "boolean" } ] ] !d
[ "/component/priority" [ { "name": "priority" "type": "integer" } ] ] !d
[ "/component/meta" [ { "name": "meta" "type": "json" } { "name": "createdAt" "type": "datetime" } ] ] !d
gather
+

[ /component/title { text: "get out of bed" } ] !c
[ /component/completed { isComplete: true } ] !c
[ /component/priority { priority: 10 } ] !c
[ /component/meta { meta: {"author":"av","tags":["first","action"]} createdAt: "2020-05-23T09:00:00.000Z" } ] !c
gather
100 !e swap +

[ /component/title { text: "phone up friend" } ] !c
[ /component/completed { isComplete: true } ] !c
[ /component/meta { createdAt: "2020-05-23T10:15:00.000Z" } ] !c
gather
101 !e swap +

[ /component/title { text: "turn on the news" } ] !c
[ /component/completed { isComplete: false } ] !c
[ /component/meta { createdAt: "2020-05-23T10:45:00.000Z" } ] !c
gather
102 !e swap +

[ /component/title { text: "drink some tea" } ] !c
[ /component/meta { meta: {"author":"jm"} } ] !c
gather
103 !e swap +

[ /component/title { text: "do some shopping" } ] !c
[ /component/priority { priority: -5 } ] !c
[ /component/meta { createdAt: "2020-05-23T15:30:00.000Z" } ] !c
gather
104 !e swap +

[ /component/priority { priority: -25 } ] !c
[ /component/meta { meta: {"notes":"empty entity"} } ] !c
gather
105 !e swap +
`);

    // printAll(es);
});


test.run();