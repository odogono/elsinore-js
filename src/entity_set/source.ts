import {
    COMPONENT_ID,
    ENTITY_ID,
    EntityEvent,
    LCMD_ADD_ENTITY,
    LCMD_COMMAND,
    LCMD_END_OF_EXISTING,
    LCMD_REGISTER_COMPONENT,
    LCMD_REMOVE_COMPONENT,
    LCMD_REMOVE_ENTITY,
    LCMD_UNKNOWN
} from '../types';
import { Component, cloneComponent } from '../component';
import { Entity, cloneEntity } from '../entity';

import { EntitySet } from '../entity_set';
import PullPushable from 'pull-pushable';
import { Query } from '../query';
import { applyQueryFilter } from '../query/through';
import { readProperty } from '../util/read_property';

interface PullStreamSourceOptions {
    query?: Query;
}

/**
 * pull-stream source - produces a stream of entities/components from the entity set
 *
 * the data that is emitted from this source takes the form of this tuple:
 *
 * [ data, options ]
 *
 * where data is an entity,component or command. options provide surrounding information
 */
export function PullStreamSource(entitySet:EntitySet, options:PullStreamSourceOptions = {}) {
    const sendExisting = readProperty(options, 'sendExisting', true);
    const useDefUris = readProperty(options, 'useDefUris', false);
    const isAnonymous = readProperty(options, 'anonymous', false);
    const emitEntities = readProperty(options, 'emitEntities', false);
    const closeAfterExisting = readProperty(options, 'closeAfterExisting', false);
    const query = options.query;

    const cdefMap = useDefUris ? entitySet.getRegistry().componentRegistry.getComponentDefUris() : null;

    let pushable = PullPushable(err => {
        // if( err ){ console.log('[entitySet][source]', err ); }
        entitySet.off(EntityEvent.EntityAdd, pushable.onEntityAdd, pushable);
        entitySet.off(EntityEvent.EntityRemove, pushable.onEntityRemove, pushable);
        entitySet.off(EntityEvent.ComponentAdd, pushable.onComponentAdd, pushable);
        entitySet.off(EntityEvent.ComponentRemove, pushable.onComponentRemove, pushable);
    });

    let entity,
        components,
        count,
        ii = 0,
        cc = 0;
    if (!entitySet) {
        pushable.end(new Error('entityset missing'));
        return pushable;
    }

    // send all existing components
    if (sendExisting) {
        const length = entitySet.size();
        let componentCount = 0;
        let sendOptions = {};

        for (ii; ii < length; ii++) {
            entity = entitySet.at(ii);
            if (emitEntities) {
                pushable.push([entity, sendOptions]);
                continue;
            }
            components = entity.getComponents();
            for (cc = 0, count = components.length; cc < count; cc++) {
                componentCount++;
                pushComponent(pushable, components[cc], cdefMap, isAnonymous);
            }
        }

        // send a command confirming End Of Existing components
        pushable.push([{ [LCMD_COMMAND]: LCMD_END_OF_EXISTING, ec: length, cc: componentCount }, sendOptions]);

        if (closeAfterExisting === true) {
            pushable.end();
        }
    }

    pushable.onEntityAdd = function(entities, options) {
        let entity,
            component,
            cc = 0,
            clen = 0,
            ee = 0,
            elen = entities.length;
        let { cid } = options;

        for (ee = 0; ee < elen; ee++) {
            entity = entities[ee];
            if (emitEntities) {
                // console.log('[pushable.onEntityAdd]', entitySet.cid, options.oid, Object.values(entity.components).map(c => c.id), options );
                pushable.push([entity, options]);
                continue;
            }
            components = entity.getComponents();
            for (cc = 0, clen = components.length; cc < clen; cc++) {
                pushComponent(pushable, components[cc], cdefMap, isAnonymous, options);
            }
        }
    };

    pushable.onEntityUpdate = function(entities, options) {
        if (!query) {
            // console.log('[pushable.onEntityUpdate]', 'no query');
            return;
        }

        let ee = 0,
            elen = entities.length;
        let removeEids = [];

        for (ee = 0; ee < elen; ee++) {
            entity = entities[ee];
            // console.log('[pushable.onEntityUpdate]', entitySet.cid, 'entity', entity.cid);
            if (!applyQueryFilter(query, entity, options)) {
                removeEids.push(entity.id);
            }
        }
        if (removeEids.length > 0) {
            this.push([{ [LCMD_COMMAND]: LCMD_REMOVE_ENTITY, eid: removeEids }, options]); // components[cc] );
        }
    };

    pushable.onComponentAdd = function(components, options) {
        // console.log('[pushable.onComponentAdd]', components.map(c => c.id), JSON.stringify(components) );
        let cc, clen;
        for (cc = 0, clen = components.length; cc < clen; cc++) {
            if (emitEntities) {
                pushable.push([cloneComponent(components[cc]), options]);
            } else {
                pushComponent(pushable, components[cc], cdefMap, isAnonymous, options);
            }
        }
    };

    // pushable.onComponentUpdate = function(components){
    //     console.log('[pushable.onComponentUpdate]', components.map(c => c.id), JSON.stringify(components) );
    // }

    pushable.onEntityRemove = function(entities, options) {
        let entity,
            ee = 0,
            elen = entities.length,
            eids = [];
        for (ee = 0; ee < elen; ee++) {
            eids.push(entities[ee].id);
        }
        if (eids.length > 0) {
            this.push([{ [LCMD_COMMAND]: LCMD_REMOVE_ENTITY, eid: eids }, options]); // components[cc] );
        }
    };

    pushable.onComponentRemove = function(components, options) {
        let cc,
            clen,
            cids = [];

        for (cc = 0, clen = components.length; cc < clen; cc++) {
            // let component = components[cc];
            cids.push(components[cc].id);
        }
        // console.log('[pushable.onComponentRemove]', entitySet.cid, components.map(c => c.id), JSON.stringify(cids) );
        if (cids.length > 0) {
            this.push([{ [LCMD_COMMAND]: LCMD_REMOVE_COMPONENT, id: cids }, options]);
        }
    };

    entitySet.on( EntityEvent.EntityAdd, pushable.onEntityAdd, pushable);
    entitySet.on( EntityEvent.EntityUpdate, pushable.onEntityUpdate, pushable);
    entitySet.on( EntityEvent.EntityRemove, pushable.onEntityRemove, pushable);
    entitySet.on( EntityEvent.ComponentAdd, pushable.onComponentAdd, pushable);
    entitySet.on( EntityEvent.ComponentUpdate, pushable.onComponentAdd, pushable); // NOTE intentional Add
    entitySet.on( EntityEvent.ComponentRemove, pushable.onComponentRemove, pushable);

    return pushable;
}

/**
 * Push details of the component to the Pushable stream
 *
 * @param {*} pushable
 * @param {*} component
 * @param {*} cdefMap
 * @param {*} isAnonymous
 */
function pushComponent(pushable, component, cdefMap, isAnonymous:boolean = false, options:object = {}) {
    // if( cdefMap ){
    let json = component.toJSON({ cdefMap });
    if (isAnonymous) {
        delete json[ENTITY_ID];
        delete json[COMPONENT_ID];
    }
    return pushable.push([json, options]);
    // }

    // pushable.push( component );
}