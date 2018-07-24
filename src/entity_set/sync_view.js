import { EntitySet } from './index';
import { Query } from '../query';

// import { stringify } from '../util/stringify';
// import { QueryFilter } from '../query/through';
import { applyQueryFilter } from '../query/through';

import {
    ENTITY_ADD,
    ENTITY_REMOVE,
    COMPONENT_ADD,
    COMPONENT_UPDATE,
    COMPONENT_REMOVE,
    VIEW_CREATE
} from '../constants';

/**
 * An entityset which mirrors another entityset through use of
 * asynchronous pull streams
 *
 * @param {*} entities
 * @param {*} options
 */
export function EntitySetSyncView(entities, options = {}) {
    EntitySet.call(this, entities, options);
}

Object.assign(EntitySetSyncView.prototype, EntitySet.prototype, {});

/**
 *
 * @param {*} entitySet
 * @param {*} query
 * @param {*} options
 */
export function create(entitySet, query, options = {}) {
    let registry = entitySet.getRegistry();

    query = Query.toQuery(query);
    entitySet._views || (entitySet._views = {});

    let queryID = query ? query.hash() : 'all';
    let existing = entitySet._views[queryID];

    if (existing) {
        return existing;
    }

    // let queryFilter = new QueryFilter(query, options);

    let view = registry.createEntitySet({ type: EntitySetSyncView, register: false });
    view._parent = entitySet;
    entitySet._views[queryID] = view;
    view.query = query;
    view.queryID = queryID;

    if (entitySet.queryID == 'all') {
        view.addEntity(entitySet.getEntities());
    } else {
        let ii,
            length = entitySet.size();

        for (ii = 0; ii < length; ii++) {
            let entity = entitySet.at(ii);
            if (applyQueryFilter(query, entity)) {
                view.addEntity(entity, options);
            }
        }
    }

    //     // console.log('[EntitySetSyncView]', 'adding entity', stringify(entity) );
    //     view.addEntity( entity, options );

    //     // if (emitEntities) {
    //     //     pushable.push([entity,sendOptions]);
    //     //     continue;
    //     // }
    //     // components = entity.getComponents();
    //     // for (cc = 0, count = components.length; cc < count; cc++) {
    //     //     componentCount++;
    //     //     pushComponent(pushable, components[cc], cdefMap, isAnonymous);
    //     // }
    // }

    view.listenTo(entitySet, ENTITY_ADD, view.onEntityAdd.bind(view));
    view.listenTo(entitySet, ENTITY_REMOVE, view.onEntityRemove.bind(view));
    view.listenTo(entitySet, COMPONENT_ADD, view.onComponentAdd.bind(view));
    view.listenTo(entitySet, COMPONENT_UPDATE, view.onComponentAdd.bind(view));
    view.listenTo(entitySet, COMPONENT_REMOVE, view.onComponentRemove.bind(view));

    // entitySet.on(ENTITY_ADD, (evt) => {
    //     console.log('ADDING!', evt);
    // })

    // send a command confirming End Of Existing components
    // pushable.push([{ '@cmd': CMD_END_OF_EXISTING, ec:length, cc:componentCount },sendOptions]);

    // if (closeAfterExisting === true) {
    //     pushable.end();
    // }

    entitySet.emit(VIEW_CREATE, view);

    return view;
}

/**
 *
 * @param {*} query
 * @param {*} options
 */
EntitySet.prototype.createView = function(query, options = {}) {
    return create(this, query, options);
};

// EntitySetSyncView.prototype.onEntityAdd = function(entities, options){
//     let ii=0,len=entities.length;
//     for (ii; ii < len; ii++) {
//         this.addEntity( entities[ii], options);
//     }
// }

EntitySetSyncView.prototype.onEntityAdd = function(entities, options) {
    let cid = options.cid;
    let addOptions = { cid };

    if (this.queryID == 'all') {
        this.addEntity(entities, addOptions);
    } else {
        let ii,
            length = entities.length;

        for (ii = 0; ii < length; ii++) {
            let entity = entities[ii];
            // console.log( this.query );
            if (applyQueryFilter(this.query, entity)) {
                // console.log('[EntitySetSyncView][onEntityAdd]', stringify(entity), options);
                this.addEntity(entity, addOptions);
            }
        }
    }
};

EntitySetSyncView.prototype.onEntityRemove = function(entities, options) {
    // console.log('[EntitySetSyncView][onEntityRemove]', stringify(entities), options);
    let ii = 0,
        len = entities.length;
    for (ii; ii < len; ii++) {
        this.removeEntity(entities[ii], options);
    }
};

// EntitySetSyncView.prototype.onEntityRemove = function(entities, options){
//     this.removeEntity(entities,options);
// }

// EntitySetSyncView.prototype.onComponentAdd = function(components, options){
//     let cc=0,clen=components.length;
//     for( cc, clen;cc<clen;cc++){
//         this.addComponent( components[cc], options );
//     }
// }

EntitySetSyncView.prototype.onComponentAdd = function(components, options) {
    this.addComponent(components, options);
};

// EntitySetSyncView.prototype.onComponentRemove = function(components, options){
//     let cc=0,clen=components.length;
//     for( cc, clen;cc<clen;cc++){
//         this.removeComponent( components[cc], options );
//     }
// }

EntitySetSyncView.prototype.onComponentRemove = function(components, options) {
    // console.log('[EntitySetSyncView][onComponentRemove]', stringify(components), options);
    this.removeComponent(components, options);
};

EntitySetSyncView.prototype.type = 'EntitySetSyncView';
EntitySetSyncView.prototype.isMemoryEntitySet = true;
EntitySetSyncView.prototype.isEntitySetView = true;
