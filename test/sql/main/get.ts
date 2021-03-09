import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    beforeEach,
    prepES,
} from '../helpers';



let test = suite('es/sqlite - get');

test.before.each( beforeEach );

test('retrieve all components on an entity', async () => {
    let [, es] = await prepES(undefined, 'todo');

    let e = await es.getEntity( 102, true );

    assert.equal( e.components.size, 3 );
    
});

test('retrieve no components on an entity', async () => {
    let [, es] = await prepES(undefined, 'todo');

    let e = await es.getEntity( 102, false );

    assert.equal( e.components.size, 0 );
});

test('retrieve some components on an entity', async () => {
    let [, es] = await prepES(undefined, 'todo');

    const bf = es.resolveComponentDefIds(['/component/title']);

    let e = await es.getEntity( 102, bf );

    assert.equal( e.components.size, 1 );
});



test.run();