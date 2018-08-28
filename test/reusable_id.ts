import _ from 'underscore';
import test from 'tape';

import { ReusableID } from '../src/util/reusable_id';
import { createLog } from '../src/util/log';

const Log = createLog('TestResuableID');

test('get', async t => {
    const rid = new ReusableID();
    const id = await rid.get();

    t.equals(id, 1);
    t.end();
});

test('get multiple', async t => {
    try {
        const rid = new ReusableID();

        const ids = await rid.getMultiple(5);

        t.deepEqual(ids, [1, 2, 3, 4, 5]);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('get queued', async t => {
    try {
        const rid = new ReusableID();

        const result = await Promise.all([rid.getMultiple(3), rid.getMultiple(3), rid.getMultiple(3)]);

        t.deepEqual(result, [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('release', async t => {
    try {
        const rid = new ReusableID();
        const id = await rid.get();
        await rid.release(id);
        const id2 = await rid.get();

        t.equals(id2, id);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('release multiple', async t => {
    try {
        const rid = new ReusableID();

        const ids = await rid.getMultiple(4);

        await rid.releaseMultiple(ids);

        const nids = await rid.getMultiple(4);

        t.deepEqual(ids, nids.reverse());

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('releasing a non-valid id', async t => {
    try {
        const rid = new ReusableID();
        await rid.release(22);
    } catch (err) {
        t.equal(err.message, '22 is not a member');
        t.end();
    }
});
