'use strict';

let _ = require('underscore');
let test = require('tape');

let Common = require('../common');
let Elsinore = Common.Elsinore;


//
// Original example from https://github.com/BlackDice/scent
//
test('main', function(t){
    let cDoor;
    return initialise().then( ([registry,entitySet]) =>
        registry.registerComponent({
            id:'/door', 
            properties:{
                open:{type:'boolean', 'default': false}, 
                material:{type:'string'} 
            } 
        }).then(cDef => [cDef,registry, entitySet]) )
    .then( ([cDoor, registry, entitySet]) => {
        let eDoor;
        let door;
        let processor;
        let DoorProcessor;
        
        DoorProcessor = Elsinore.EntityProcessor.extend({
            // handle entity events
            events:{

                'doorOpen': (entity, entitySet, msg) => entity.Door.set({'open': true, msg: msg}),
                'doorClose': (entity, entitySet) => entity.Door.set('open', false)
                // 'all': function(entity, es){
                //     log.debug('!all ' + JSON.stringify(arguments));
                // }
            },

            closingTime: {
                'wood': 200,
                'metal': 300,
                'stone': 500
            },

            onUpdate: function( entityArray, timeMs ){
                let entity, ii, len;
                let closeTime;
                
                _.each( entityArray, entity => {
                    closeTime = this.closingTime[ entity.Door.get('material') ];
                    if (timeMs >= entity.Door.get('open') + closeTime ) {
                        entity.Door.set({open:false});
                        // eDoor.triggerEntityEvent( 'doorClose' );
                    }
                });
            }
        });

        

        // attach the processor to the entityset. the priority will
        // be normal
        processor = registry.addProcessor( DoorProcessor, entitySet );
        
        door = registry.createComponent( cDoor, {material: 'wood'} );
        
        // adding the component to the entityset will create an entity
        entitySet.addComponent( door );

        // retrieve the first (and only entity) from the set
        eDoor = entitySet.at( 0 );

        // trigger an event on the entity set - this will open all door
        // components
        eDoor.triggerEntityEvent( 'doorOpen', 'now please' );

        // the event isn't triggered until an update
        t.equals( eDoor.Door.get('open'), false, 'the door is not yet open' );

        // an update has to occur for events to be processed
        registry.updateSync();

        // as a result of the event, the door should now be open
        t.equals( eDoor.Door.get('open'), true, 'the door should be open' );

        t.equals( eDoor.Door.get('msg'), 'now please', 'a message was also set');

        // run an update over all the entitysets in the registry - passing a
        // specific update time
        registry.updateSync( Date.now() + 300 );

        // as a result of the processor update, the door should now be closed
        t.equals( eDoor.Door.get('open'), false, 'the door should be closed' );

        t.end();
    })
    .catch( err => log.error('test error: ' + err.stack) )
});


function initialise(){
    return Common.initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let entities = Common.loadEntities( registry );
        return [registry,entitySet,entities];    
    });
}


