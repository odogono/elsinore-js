import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    createLog,
    initialiseRegistry,
    // loadEntities,
    logEvents,
    entityToString,
    toInteger
} from '../common';

const Log = createLog('TestIntegrationReaper');

import { EntityProcessor } from '../../src/entity_processor';
import { EntityDispatch } from '../../src/dispatch';
import { JSONLoader } from '../../src/util/loader';

let VOI;

test.skip('processor views are updated', async t => {
    try {
        const registry = await initialiseRegistry();
        const entitySet = registry.createEntitySet();
        const dispatch = EntityDispatch.create(entitySet);

        await registerTestComponents(entitySet);

        let reaper = dispatch.addProcessor(ReaperProcessor);
        let connection = dispatch.addProcessor(ConnectionProcessor, null, { priority: -200 });

        
        entitySet.addEntity( [
            { '@c': '/connection', addr: '192.3.0.1' },
            { '@c': '/ttl', expires_at: -300 },
            { '@c': '/dead', expires_at: -300 },
        ]);
        
        // reaper.get('view').applyEvents();
        // connection.get('view').applyEvents();
        
        Log.debug('💀', entityToString( reaper.get('view') ));
        Log.debug('📶', entityToString( connection.get('view') ));

        // reaper.get('view')

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

/**
    This test demonstrates processors that use filters to determine which
    components it should operate on
*/
test('reaper', async t => {
    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();
    const dispatch = EntityDispatch.create(entitySet);
    const eventSpy = Sinon.spy();

    try {
        entitySet.on('all', eventSpy);
        // logEvents( entitySet );

        await createTestEntitySet(registry, entitySet);

        // let reaper = new ReaperProcessor();

        let reaper = dispatch.addProcessor(ReaperProcessor);
        // reaper.set({isDisabled:true});
        // logEvents(reaper.get('view'), '[evt][💀]');

        // the connection processor has a higher priority
        let connection = dispatch.addProcessor(ConnectionProcessor, null, { priority: -200 });
        // logEvents(connection.get('view'), '[evt][📶]');
        // VOI = connection.get('view');
        // VOI.debug = true;

        // Log.debug('🐭 connection', entityToString(VOI));
        // Log.debug('📶 ttl', entityToString(entitySet.query(Q => Q.all('/ttl'))));

        // logEvents( entitySet );
        // 500ms of time elapses...
        dispatch.update(500, { debug: false });

        // Log.debug('📶 connection size', VOI.size() );

        //
        t.ok(eventSpy.calledWith('entity:remove'), 'one entity will have been removed');

        t.equals(entitySet.size(), 4, 'four connection entities remain');

        // Log.debug('📶 connection', entityToString(entitySet));
        // Log.debug(`📶 view[${VOI.cid}]`, entityToString(VOI));
        // Log.debug('📶 ttl', entityToString(entitySet.query(Q => Q.all('/ttl'))));

        // console.log('>---');

        dispatch.update(3000, { debug: false });

        // Log.debug('💀 reaper', reaper.get('view').cid, entityToString(reaper.get('view')));
        // console.log('?---');
        // reaper.update( VOI );

        // Log.debug('🐴 connection', entityToString(entitySet));

        // Log.debug('🐴 dead ones 💀', entityToString(entitySet.query(Q => Q.all('/dead'))));

        t.equals(entitySet.size(), 3, 'three connection entities remain');
        //*/

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

/**
 *   The reaper processor looks out for entities that have a certain component, and
 *   deletes them from the entitySet
 */
class ReaperProcessor extends EntityProcessor {

    // the processor will receive entities which have the /dead component
    entityFilter = (Q) => Q.all('/dead')

    /**
     * @override
     */
    update(entities, timeMs) {
        let entity, ii, len;
        this.currentTime = this.currentTime + timeMs;
        // Log.debug('/p/reaper ', this.view.cid, entities.size() + ' models', entityToString(this.view) );
        // Log.debug(`[💀][ReaperProcessor][${this.id}][${this.currentTime}]`, 'update', entities.size());

        // any entities marked as dead should be removed
        for (ii = 0, len = entities.size(); ii < len; ii++) {
            entity = entities.at(ii);
            // Log.debug('[💀][ReaperProcessor] destroying entity', entity.id);
            this.destroyEntity(entity);
        }
    }
}

class ConnectionProcessor extends EntityProcessor {

    entityFilter = (Q) => Q.all('/ttl')

    constructor(options = {}) {
        super(options);
        this.currentTime = toInteger(options.currentTime, 0);
    }

    /**
     * @override
     */
    update(entities, timeMs) {
        let entity, ii, len;
        this.currentTime = this.currentTime + timeMs;
        // Log.debug('[ConnectionProcessor]>', entities.cid,'update', entities.size(), 'entities', entityToString(entities) );

        // any entities which have an expired ttl should be marked as dead
        for (ii = 0, len = entities.size(); ii < len; ii++) {
            entity = entities.at(ii);
            const ttl = entity.Ttl.get('expires_at');
            // Log.debug(`[ConnectionProcessor][${this.currentTime}] update`, entity.id, ttl, this.currentTime, ttl <= this.currentTime);

            if (ttl <= this.currentTime) {
                // removing /ttl means that this will no longer be processed
                // by this processor
                // Log.debug('removing /ttl from ' + entity.id);
                this.removeComponentFromEntity(entity.Ttl, entity);

                // adding the /dead component means that the entity will
                // eventually be destroyed by the reaper processor
                // Log.debug('adding dead to ' + entity.id);
                // entity.addComponent( this.createComponent('/dead') );
                this.addComponentToEntity('/dead', entity);
            }
        }
        // Log.debug('[ConnectionProcessor]<', entities.cid,'update', entities.size(), 'entities', entityToString(entities) );
    }
}

async function createTestEntitySet(registry, entitySet) {
    const commands = [
        { '@cmd': 'register', uri: '/connection', properties: { addr: { type: 'string' } } },
        { '@cmd': 'register', uri: '/ttl', properties: { expires_at: { type: 'number' } } },
        { '@cmd': 'register', uri: '/dead' },

        { '@c': '/connection', addr: '192.3.0.1' },
        { '@c': '/ttl', expires_at: -300 },
        { '@cmd': 'entity' },
        { '@c': '/connection', addr: '192.3.0.2' },
        { '@cmd': 'entity' },
        { '@c': '/connection', addr: '192.3.0.3' },
        { '@cmd': 'entity' },
        { '@c': '/connection', addr: '192.3.0.4' },
        { '@c': '/ttl', expires_at: 2000, comment: 'b' },
        { '@cmd': 'entity' },
        { '@c':'/connection', 'addr': '192.3.0.5'},
        { '@cmd':"entity" },
    ];

    const loader = JSONLoader.create();
    await loader.load(commands, entitySet);
    return entitySet;
}


async function registerTestComponents( entitySet ){
    const commands = [
        { '@cmd': 'register', uri: '/connection', properties: { addr: { type: 'string' } } },
        { '@cmd': 'register', uri: '/ttl', properties: { expires_at: { type: 'number' } } },
        { '@cmd': 'register', uri: '/dead' },
    ];

    const loader = JSONLoader.create();
    await loader.load(commands, entitySet);
    return entitySet;
}