import _ from 'underscore';
import test from 'tape';
import Sinon from 'sinon';

import {
    createLog,
    initialiseRegistry,
    // loadEntities,
    logEvents,
    entityToString,
    // stringify,
} from '../common';

import {
    toInteger
} from '../../src/util';

const Log = createLog('TestIntegrationOpenDoor');

import EntityProcessor from '../../src/entity_processor';
import Dispatch from '../../src/dispatch';
import {JSONLoader} from '../../src/util/loader';

/**
    This test demonstrates processors that use filters to determine which
    components it should operate on
*/
test('reaper', async t => {
    
    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();
    const dispatch = Dispatch.create(entitySet);
    const eventSpy = Sinon.spy();

    try {
        entitySet.on('all', eventSpy);

        await createTestEntitySet( registry, entitySet );

        dispatch.addProcessor(ReaperProcessor);
        // the connection processor has a higher priority
        dispatch.addProcessor(ConnectionProcessor, null, {priority:-200});

        // logEvents( entitySet );
        // 500ms of time elapses...
        dispatch.update(500);

        // 
        t.ok( eventSpy.calledWith('entity:remove'), 'two entities will have been removed' );
        
        t.equals( entitySet.length, 4, 'four connection entities remain' );


        // 800ms of time elapses...
        dispatch.update(1500);
        t.equals( entitySet.length, 3, 'three connection entities remain' );


        t.end();
    } catch(err){
        Log.error(err.stack);
    }
});


/**
*   The reaper processor looks out for entities that have a certain component, and
*   deletes them from the entitySet
*/
class ReaperProcessor extends EntityProcessor{
    constructor(options){
        super(options);
        
        // the processor will receive entities which have the /dead component
        this.entityFilter = Q => Q.all('/dead');
    }
    
    /**
     * @override
     */
    update( entityArray, timeMs ){
        let entity, ii, len;
        // log.debug('/p/reaper ' + entityArray.length + ' models' );
        // any entities marked as dead should be removed
        for( ii=0,len=entityArray.length;ii<len;ii++ ){
            entity = entityArray[ii];
            // Log.debug('[ReaperProcessor] destroying entity', entity.id );
            this.destroyEntity( entity );
        }
    }
}

class ConnectionProcessor extends EntityProcessor {
    constructor(options={}){
        super(options);
        this.currentTime = toInteger(options.currentTime,0);
        this.entityFilter = Q => Q.all('/ttl');
    }
    
    /**
     * @override
     */
    update( entityArray, timeMs ){
        let entity, ii, len;
        this.currentTime = this.currentTime + timeMs;
        // Log.debug('[ConnectionProcessor] update', entityArray.length, 'entities');
        
        // any entities which have an expired ttl should be marked as dead
        for( ii=0,len=entityArray.length;ii<len;ii++ ){
            entity = entityArray[ii];
            const ttl = entity.Ttl.get('expires_at');
            Log.debug('[ConnectionProcessor] update', entity.id, ttl, this.currentTime );

            if( ttl <= this.currentTime ){
                // removing /ttl means that this will no longer be processed
                // by this processor
                this.removeComponentFromEntity( entity.Ttl, entity );

                // adding the /dead component means that the entity will 
                // eventually be destroyed by the reaper processor
                // log.debug('adding dead to ' + entity.id );
                this.addComponentToEntity( '/dead', entity );
            }
        }
    }
}




async function createTestEntitySet( registry, entitySet ){

    const commands = [
        { '@cmd':'register', 'uri':'/connection', properties:{addr:{type:'string'}} },
        { '@cmd':'register', 'uri':'/ttl', properties:{expires_at:{type:'number'}} },
        { '@cmd':'register', 'uri':'/dead'},

        { '@c':'/connection', 'addr': '192.3.0.1'},
        { '@c':'/ttl', expires_at:-300 },
        { '@cmd':"entity" },
        { '@c':'/connection', 'addr': '192.3.0.2'},
        { '@cmd':"entity" },
        { '@c':'/connection', 'addr': '192.3.0.3'},
        { '@cmd':"entity" },
        { '@c':'/connection', 'addr': '192.3.0.4'},
        { '@c':'/ttl', expires_at:2000, 'comment':'b' },
        { '@cmd':"entity" },
        { '@c':'/connection', 'addr': '192.3.0.5'},
        { '@cmd':"entity" },
    ];

    const loader = JSONLoader.create();
    await loader.load( commands, entitySet );
    return entitySet;

}
