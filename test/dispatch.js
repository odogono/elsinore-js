import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Entity,
    EntityProcessor,
    initialiseRegistry, // loadEntities,
    // loadFixtureJSON,
    // printE,
    // stringify,
    // logEvents,
    entityToString,
    createLog
} from './common';

import { EntityDispatch } from '../src/dispatch';

import { ENTITY_ADD } from '../src/constants';

const Log = createLog('TestDispatch');

/**

A utility for executing processors.

The idea here is that processors are registered with a query, which decides which entities they
are given to process. Then when an entity is passed in, each of the matching processors executes with
it.

    * further directions

        - processors may have identical queries. cache the query so that it is only executed once

        - execute a given processor at a given time interval only - eg, execute once every n seconds

        - manage the prioritising of processor execution

        - when an entity is accepted by a query, cache it's signature (component bits) so that the
        next time it (or something similar) passes through, the query won't have to be run.
        this may not always work, because the query may be selecting on component attributes.

        - the dispatch works either by having each processor process each entity in the ES:

        procA - updates each e in the ES
        procB - updates each e in the ES
        ...

        OR by limiting the execution to the first entity in the ES. by using an execute limit.

        procA - updates the first e in the ES
        procB - updates the first e in the ES - if exists
        ...

        so that is two types of operation for processors:
        - an entityset view (based on the p. query) is prepared for the processor ahead of execution
        - (adhoc) the processor works on the entityset as is, evaluating each entity against its query.

    
    - execute can be called with an entity, an entityset, or nothing at all. processors are called
    regardless

*/
test('adding a processor', async t => {
    try {
        const registry = await initialiseRegistry();
        const dispatch = EntityDispatch.create();

        class Proc extends EntityProcessor {}
        Proc.prototype.type = 'ProcProcessor';

        dispatch.addProcessor(Proc);

        const instance = dispatch.getProcessors()[0];

        // Log.debug('instance isa', typeof instance, Proc.prototype );
        // ensure that what is stored is an instance not the class
        t.equals(instance.isEntityProcessor, true);
        t.equals(instance.type, 'ProcProcessor');
        t.equals(instance instanceof Proc, true);

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('basic execution of a processor', t => {
    const dispatch = EntityDispatch.create();
    let executeCount = 0;

    const processor = createEntityProcessor((entityArray, timeMs, options) => executeCount++);

    const otherProcessor = createEntityProcessor((entityArray, timeMs, options) => executeCount++);

    dispatch.addProcessor(processor);
    dispatch.addProcessor(otherProcessor);

    // register a second processor with no query
    const entity = Entity.create();

    dispatch.update(entity);

    t.equals(executeCount, 2);
    t.end();
});

test('will only execute processors which match', async t => {
    try {
        const registry = await initialiseRegistry();
        const dispatch = EntityDispatch.create(registry);
        let executeCount = 0;

        const processor = createEntityProcessor((entityArray, timeMs, options) => executeCount++);

        const otherProcessor = createEntityProcessor((entityArray, timeMs, options) => executeCount++);

        dispatch.addProcessor(processor, Q => Q.all('/component/hostname'));
        dispatch.addProcessor(otherProcessor, Q => Q.all('/component/username'));

        let entity = registry.createEntity({ '@c': '/component/username', username: 'fred' });

        dispatch.execute(entity);

        // only one processor matches the query
        t.equals(executeCount, 1);

        dispatch.execute(entity);
        t.equals(executeCount, 2);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('executing a processor with a time interval', async t => {
    try {
        const registry = await initialiseRegistry();
        const dispatch = EntityDispatch.create(registry);
        let entity = registry.createEntity({ '@c': '/component/username' });
        let executeCount = 0;

        const processor = createEntityProcessor((entityArray, timeMs, options) => executeCount++);

        // executes every 1000ms
        dispatch.addProcessor(processor, null, { interval: 1000 });

        dispatch.execute(entity, 0);
        t.equals(executeCount, 1);

        dispatch.execute(entity, 100);
        t.equals(executeCount, 1, 'no further execution within interval');

        dispatch.execute(entity, 1000);
        t.equals(executeCount, 2, 'another execution now that interval expired');

        dispatch.execute(entity, 999, true);
        t.equals(executeCount, 2);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('retrieving all the processors assigned to a query', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const dispatch = EntityDispatch.create(entitySet);

        const a = createEntityProcessor();
        const b = createEntityProcessor();
        class ProcC extends EntityProcessor {
            entityFilter() {
                return Q => Q.all('/component/username');
            }
        }

        dispatch.addProcessor(a, Q => Q.all('/component/username'));
        dispatch.addProcessor(b, Q => Q.none('/component/username'));
        dispatch.addProcessor(ProcC, Q => Q.all('/component/username'));

        const procs = dispatch.getProcessorsForQuery(Q => Q.all('/component/username'));
        t.equal(procs.length, 2);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('processors receive update events', async t => {
    try {
        const registry = await initialiseRegistry();
        const dispatch = EntityDispatch.create();
        let updateCount = 0;

        class Processor extends EntityProcessor {
            update() {
                updateCount += 1;
            }
        }

        dispatch.addProcessor(Processor);
        dispatch.update();
        dispatch.update();

        t.equals(updateCount, 2);

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('processor update intervals', async t => {
    try {
        const registry = await initialiseRegistry();
        const dispatch = EntityDispatch.create();
        let updateCount = 0;

        class Processor extends EntityProcessor {
            update() {
                updateCount += 1;
            }
        }

        dispatch.addProcessor(Processor, null, { interval: 1000 });
        dispatch.update();
        dispatch.update(600);
        dispatch.update(600);
        dispatch.update(1000);
        dispatch.update();

        t.equals(updateCount, 3);

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('processor priority', async t => {
    try {
        const registry = await initialiseRegistry();
        const dispatch = EntityDispatch.create();
        let result = [];

        const procA = createEntityProcessor(() => {
            result.push('a');
        });
        const procB = createEntityProcessor(() => {
            result.push('b');
        });
        const procC = createEntityProcessor(() => {
            result.push('c');
        });

        dispatch.addProcessor(procA, null, { priority: 100 });
        dispatch.addProcessor(procB, null, { priority: -10 });
        // lowest number is highest priority
        dispatch.addProcessor(procC, null, { priority: 0 });

        dispatch.update();
        // Log.debug('bleah', dispatch.processorEntries.map( e => e.get('priority')) );
        t.deepEqual(result, ['b', 'c', 'a']);

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('processor should receive an event when entities are added', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const dispatch = EntityDispatch.create(entitySet);
        let isAdded = false;
        class Proc extends EntityProcessor {
            constructor(...args) {
                super(...args);
                this.events = { [ENTITY_ADD]: this.onAdded };
            }
            onAdded(entityArray) {
                isAdded = true;
            }
        }

        const processor = dispatch.addProcessor(Proc);

        entitySet.addEntity({ '@c': '/component/position', x: 100, y: 22 });
        t.assert(!isAdded, 'entity not added until update is called');

        dispatch.update(0, { debug: false });
        t.assert(isAdded, 'entity added when update is called');

        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('processor can affect original entityset', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const dispatch = EntityDispatch.create(entitySet);

        class Proc extends EntityProcessor {
            constructor(...args) {
                super(...args);
                this.entityFilter = Q => Q.all('/component/username');
                this.events = { [ENTITY_ADD]: this.onAdded };
            }

            /**
             * 
             * @param {*} entityArray 
             */
            onAdded(entityArray) {
                // Log.debug('[onAdded]',  entityToString(entityArray) ); 
                const entity = entityArray[0];
                const username = entity.Username.get('username');
                const component = { '@c': '/component/status', status: 'active' };
                const position = { '@c': '/component/position' };

                entityArray.forEach(e => this.addComponentToEntity([component, position], e));
                // Log.debug('[onAdded]')
                this.createEntity([
                    { '@c': '/component/username', username: `friend of ${username}` },
                    { '@c': '/component/status', status: 'active' }
                ]);
            }
        }

        const processor = dispatch.addProcessor(Proc).processor;

        entitySet.addEntity({ '@c': '/component/username', username: 'bob' });
        // this next entity wont be added, as it doesnt pass the processors filter
        entitySet.addEntity({ '@c': '/component/channel', name: 'channel4' });
        entitySet.addEntity({ '@c': '/component/username', username: 'alice' });

        dispatch.update(0, { debug: false });
        // t.equals( addCount, 2, 'only two applicable entities added' );
        // Log.debug('[es]', entityToString(entitySet));

        t.equals(
            entitySet.query(Q => Q.all('/component/username').where(Q.attr('username').equals(/friend of/))).size(),
            2,
            'two new entities added to src entityset'
        );

        // Log.debug('friends', entityToString(friends));
        // entitySet.removeByQuery( Q => Q.all('/component/username') );
        // registry.updateSync( 0, {debug:false} );
        // t.equals( removeCount, 2, 'two applicable entities removed' );
        // Log.debug('proc es', entityToString(processor.entitySet));
        t.end();
    } catch (err) {
        Log.error(err.message, err.stack);
    }
});

test('dispatch can modify the incoming entityset');

test('processors executing with promises');

function createEntityProcessor(onUpdate) {
    class Processor extends EntityProcessor {}

    let result = new Processor();
    if (onUpdate) {
        result.update = _.bind(onUpdate, result);
    }

    // const result = EntityProcessor.create();
    // result.onUpdate = onUpdate;
    return result;
}
// test('match on query', t => {
//     // register a processor with a query
//     // register a second processor with a different kind of query
//     // pass an entity with a particular component pattern
//     // only one of the processors should have executed
//     t.ok(false);
//     t.end();
// })
