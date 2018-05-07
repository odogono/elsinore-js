import _ from 'underscore';
import test from 'tape';

import {
    Component,
    Entity,
    EntitySet,
    Query,
    initialiseRegistry,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    logEvents,
    createLog,
    entityToString,
} from './common';
import { isComponent, isEntity, isEntitySet } from '../src/util/is';
const Log = createLog('TestQuery');


test('return entity by id', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        let result = entitySet.selectById(5);
        t.ok(isEntitySet(result));
        t.equals(result.size(), 1);
        t.end();
    });
});

test('return entities by id', t => {
    initialiseEntitySet().then(([registry, entitySet]) => {
        let result = entitySet.selectById([5, 6, 7]);
        t.ok(isEntitySet(result));
        t.equals(result.size(), 3);
        t.end();
    });
});

test('return entity by id in an array', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();
        
        let result = entitySet.selectById(5, false);
        
        t.notOk(isEntitySet(result));

        t.equals(result.length, 1);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('query returns an entityset of entities', async t => {
    try {
        const [registry, entitySet] = await initialiseEntitySet();

        const result = entitySet.query(Q => Q.selectById([3, 4]));
        
        t.ok(result.isEntitySet, 'the result is an entityset');
        
        t.equals(result.size(), 2, '2 entities returned');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('returns entities from the root entitySet', t => {
    initialiseEntitySet()
        .then(([registry, entitySet]) => {
            let subset;
            subset = entitySet.query(Q => [
                Q.all('/component/channel'),
                // set the 2nd arg to true means that the root entityset will be selected
                Q.selectById([16, 17, 18], true)
            ]);
            t.equals(subset.size(), 3, 'three entities selected');

            subset = entitySet.query(Q => [
                Q.all('/component/channel'),
                // this time, select works from the current selected context, which means
                // the supplied argument will be invalid
                Q.selectById([15, 16, 17])
            ]);
            // printE( subset );
            t.equals(subset.size(), 0, 'no entities selected');
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

test('will use the previous result if an argument isnt supplied', t => {
    initialiseEntitySet()
        .then(([registry, entitySet]) => {
            let result = entitySet.query(Q => [
                Q.all('/component/channel_member'),
                Q.pluck('/component/channel_member', 'channel'),
                Q.selectById()
            ]);
            // printE( result );
            t.equals(result.size(), 3);
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

function initialiseEntitySet(entityDataName = 'query.entities') {
    return initialiseRegistry(false).then(registry => {
        let entitySet = loadEntities(registry, entityDataName);
        return [registry, entitySet];
    });
}
