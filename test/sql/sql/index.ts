import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    buildEntitySet,
    ChangeSetOp,
    createEntitySet,
    Component,
    Entity,
    EntitySetInst,
    getChanges,
    getComponentDefId,
    isEntity,
    Log,
    OrphanComponent,
    beforeEach,
    prepES,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';
import { printAll } from '../../es/helpers';




let test = suite('es/sqlite - special cases');

test.before.each( beforeEach );

// test('fetches entities by id', async () => {
//     let query = `[ 105 @eid /component/meta !bf @c ] select`;
//     let [stack,es] = await prepES(query, 'todo');

//     // ilog(stack.items);
//     let result = stack.popValue();

//     // ilog( result );

//     // the return value is an entity
//     // assert.equal(result.id, 102);

//     console.log( result );
//     // await printAll( es );
// });

test.run();