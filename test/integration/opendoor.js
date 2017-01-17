import _ from 'underscore';
import test from 'tape';

import {
    createLog,
    initialiseRegistry,
    loadEntities,
    stringify,
} from '../common';

const Log = createLog('TestIntegrationOpenDoor');

import EntityProcessor from '../../src/entity_processor';
import Dispatch from '../../src/dispatch';



//
// Original example from https://github.com/BlackDice/scent
//
test('main', async t => {
    let eDoor;
    const [registry,entitySet] = await initialise();

    try {
        await registry.registerComponent({
            uri:'/door', 
            properties:{
                open:{type:'boolean', 'default': false}, 
                material:{type:'string'} 
            } 
        });

        const dispatch = Dispatch.create(entitySet);

        dispatch.addProcessor(DoorProcessor);
        
        // attach the processor to the entityset. the priority will
        // be normal
        // registry.addProcessor( DoorProcessor, entitySet );
        
        // door = registry.createComponent(  );
        
        // adding the component to the entityset will create an entity
        entitySet.addComponent( {'@c':'/door', material: 'wood'} );

        // retrieve the first (and only entity) from the set
        eDoor = entitySet.at(0);

        // trigger an event on the entity set - this will open all door
        // components
        eDoor.triggerEntityEvent( 'doorOpen', 'now please' );

        // the event isn't triggered until an update
        t.equals( eDoor.Door.get('open'), false, 'the door is not yet open' );

        // an update has to occur for events to be processed
        // registry.updateSync({debug:true});
        dispatch.update();

        // as a result of the event, the door should now be open
        t.equals( eDoor.Door.get('open'), true, 'the door should be open' );

        t.equals( eDoor.Door.get('msg'), 'now please', 'a message was also set');

        // run an update over all the entitysets in the registry - passing a
        // specific update time
        // registry.updateSync(Date.now() + 300);
        dispatch.update(300);

        // as a result of the processor update, the door should now be closed
        t.equals( eDoor.Door.get('open'), false, 'the door should be closed' );

        t.end();
    } catch(err){
        Log.error(err.stack);
    }
});

class DoorProcessor extends EntityProcessor {

    constructor(options={}){
        super(options);
        this.closingTime = {
            'wood': 200,
            'metal': 300,
            'stone': 500
        };
        this.events = {
            'doorOpen': (entity, entitySet, msg) => {
                // throw new Error('heck');
                // Log.debug(`[doorOpen]`, stringify([msg]));
                entity.Door.set({'open': true, msg: msg})
            },
            'doorClose': (entity, entitySet) => {
                entity.Door.set('open', false);
            },
            // 'all': function(entity, es){
            //     log.debug('!all ' + JSON.stringify(arguments));
            // }
        }
    }

    /**
     * 
     * @override
     */
    update( entityArray, timeMs ){
        // let entity, ii, len;
        let closeTime;
        _.each( entityArray, entity => {
            closeTime = this.closingTime[ entity.Door.get('material') ];
            if (timeMs >= entity.Door.get('open') + closeTime ) {
                entity.Door.set({open:false});
                // eDoor.triggerEntityEvent( 'doorClose' );
            }
        });
    }
}

async function initialise(){
    const registry = await initialiseRegistry()
    let entitySet = registry.createEntitySet();
    let entities = loadEntities( registry );
    return [registry,entitySet,entities];
}


