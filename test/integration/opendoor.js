import _ from 'underscore';
import test from 'tape';

import {
    createLog,
    initialiseRegistry,
    loadEntities,
    stringify,
} from '../common';

const Log = createLog('TestIntegrationOpenDoor');

import { EntityProcessor } from '../../src/entity_processor';
import { EntityDispatch } from '../../src/dispatch';



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

        const dispatch = EntityDispatch.create(entitySet);

        dispatch.addProcessor(DoorProcessor);
        
        // attach the processor to the entityset. the priority will
        // be normal
        // registry.addProcessor( DoorProcessor, entitySet );
        
        // door = registry.createComponent(  );
        
        // adding the component to the entityset will create an entity
        entitySet.addComponent( {'@c':'/door', material: 'wood'} );

        // retrieve the first (and only entity) from the set
        eDoor = entitySet.getUpdatedEntities();// entitySet.at(0);


        // trigger an event on the entity set - this will open all door
        // components
        eDoor.triggerEntityEvent( 'doorOpen', 'now please' );

        // the event isn't triggered until an update
        t.equals( eDoor.Door.get('open'), false, 'the door is not yet open' );

        // an update has to occur for events to be processed
        // registry.updateSync({debug:true});
        // console.log('>--');
        dispatch.update(0, {debug:false});

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
                // args.forEach( a => Log.debug('arg type', a.type))
                // Log.debug(`[doorOpen]`, stringify(args));
                entity.Door.set({'open': true, msg })
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
    update( entities, timeMs ){
        let entity, ii, len;
        let closeTime;
        
        for( ii=0,len=entities.size();ii<len;ii++){
            entity = entities.at(ii);
            
            closeTime = this.closingTime[ entity.Door.get('material') ];

            if (timeMs >= entity.Door.get('open') + closeTime ) {
                entity.Door.set({open:false});
            }
        }
    }
}

async function initialise(){
    const registry = await initialiseRegistry()
    let entitySet = registry.createEntitySet();
    let entities = loadEntities( registry );
    return [registry,entitySet,entities];
}


