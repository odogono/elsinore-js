import { assert } from 'chai';
import { createLog } from '../src/util/log';
import {ComponentRegistry, create as createComponentRegistry} from '../src/component_registry';

const Log = createLog('TestEntitySet');

// require("fake-indexeddb/auto");
let registry:ComponentRegistry;


describe('Entity Set (Mem)', () => {
    beforeEach( () => {
        registry = createComponentRegistry();
    })


    describe('Adding', () => {
        it('should add an entity', () => {
            
            const insts = [
                [ '@c', '/component/channel', {name: 'chat'} ],
                [ '@c', '/component/status', {status: 'inactive'} ],
                [ '@c', '/component/topic', {topic: 'conversation'} ],
                [ 'AD', '@e' ]
            ]

            // buildEntity( registry, ({component, entity}) => {
            //     component('/component/channel', {name: 'chat'});
            //     component('/component/status', {status: 'inactive'});
            //     component('/component/topic', {status: 'data-structures'});
            // })
    
        });

    })

})