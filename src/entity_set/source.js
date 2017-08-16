import PullPushable from 'pull-pushable';

import readProperty from '../util/read_property';

/**
 * pull-stream source - produces a stream of entities/components from the entity set
 */
export default function source(entitySet, options = {}) {
    const sendExisting = readProperty(options, 'sendExisting', true);
    const useDefUris = readProperty(options, 'useDefUris', false);
    const isAnonymous = readProperty(options, 'anonymous', false);
    const emitEntities = readProperty(options, 'emitEntities', false);

    const cdefMap = useDefUris ? entitySet.getSchemaRegistry().getComponentDefUris() : null;

    let pushable = PullPushable(err => {
        // if( err ){ console.log('[entitySet][source]', err ); }
        entitySet.off('entity:add', pushable.onEntityAdd, pushable);
        entitySet.off('entity:remove', pushable.onEntityRemove, pushable);
        entitySet.off('component:remove', pushable.onComponentRemove, pushable);
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

        for (ii; ii < length; ii++) {
            entity = entitySet.at(ii);
            components = entity.getComponents();
            if (emitEntities) {
                pushable.push(entity);
                continue;
            }
            for (cc = 0, count = components.length; cc < count; cc++) {
                pushComponent(pushable, components[cc], cdefMap, isAnonymous);
            }
        }

        if (options.closeAfterExisting === true) {
            pushable.end();
        }
    }

    pushable.onEntityAdd = function(entities) {
        let entity,
            component,
            cc = 0,
            clen = 0,
            ee = 0,
            elen = entities.length;
        for (ee = 0; ee < elen; ee++) {
            entity = entities[ee];
            if (emitEntities) {
                pushable.push(entity);
                continue;
            }
            components = entity.getComponents();
            for (cc = 0, clen = components.length; cc < clen; cc++) {
                pushComponent(pushable, components[cc], cdefMap, isAnonymous);
            }
        }
    };

    pushable.onEntityRemove = function(entities) {
        let entity,
            ee = 0,
            elen = entities.length,
            eids = [];
        for (ee = 0; ee < elen; ee++) {
            eids.push(entities[ee].id);
        }
        if (eids.length > 0) {
            this.push({ '@cmd': 'rme', eid: eids }); // components[cc] );
        }
    };

    pushable.onComponentRemove = function(components) {
        let component,
            cc,
            clen,
            cids = [];

        for (cc = 0, clen = components.length; cc < clen; cc++) {
            component = components[cc];
            cids.push(components[cc].id);
        }
        if (cids.length > 0) {
            this.push({ '@cmd': 'rmc', cid: cids }); // components[cc] );
        }
    };

    entitySet.on('entity:add', pushable.onEntityAdd, pushable);
    entitySet.on('entity:remove', pushable.onEntityRemove, pushable);
    entitySet.on('component:remove', pushable.onComponentRemove, pushable);

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
function pushComponent(pushable, component, cdefMap, isAnonymous = false) {
    // if( cdefMap ){
    let json = component.toJSON({ cdefMap });
    if (isAnonymous) {
        delete json['@e'];
        delete json['@i'];
    }
    return pushable.push(json);
    // }

    // pushable.push( component );
}
