import _ from 'underscore';

import Entity from '../entity';
import EntitySet from './index';
import CmdBuffer from '../cmd_buffer/async';
import * as Utils from '../util';


const AsyncEntitySet = EntitySet.extend({

    type: 'AsyncEntitySet',
    // even though we are memory based, setting this to false informs the
    // registry that we wish to be treated differently.
    isMemoryEntitySet:false,
    isAsync: true,
    cidPrefix: 'aes',


    initialize: function(entities, options={}){
        console.log('init AsyncEntitySet');
        options.cmdBuffer = CmdBuffer;
        EntitySet.prototype.initialize.apply(this, arguments);
    },



    /**
     * TODO: finish
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update: function(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved) {
        return Promise.resolve({
            entitiesAdded,
            entitiesUpdated,
            entitiesRemoved,
            componentsAdded,
            componentsUpdated,
            componentsRemoved,
        });
    },
});

export default AsyncEntitySet;