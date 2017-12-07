import EntitySet from './index';
import Pull from 'pull-stream';
import PullMap from 'pull-stream/throughs/map';
import Query from '../query';

import stringify from '../util/stringify';
import QueryFilter from '../query/through';

/**
 * An entityset which mirrors another entityset through use of
 * asynchronous pull streams
 *
 * @param {*} entities
 * @param {*} options
 */
export function EntitySetAsyncView(entities, options = {}) {
    EntitySet.call(this, entities, options);
}

Object.assign(EntitySetAsyncView.prototype, EntitySet.prototype, {});

/**
 *
 * @param {*} query
 * @param {*} options
 */
export function create(entitySet, query, options = {}) {
    let registry = entitySet.getRegistry();

    query = Query.toQuery(query);
    entitySet._views || (entitySet._views = {});

    let queryId = query ? query.hash() : 'all';
    let existing = entitySet._views[queryId];

    if (existing) {
        return existing;
    }

    let view = registry.createEntitySet({ type: EntitySetAsyncView, register: false });
    view._parent = this;
    entitySet._views[queryId] = view;

    entitySet.emit('view:create', view);

    return new Promise((resolve, reject) => {
        // the first update stream sends all the existing entities and then closes
        createUpdateStream(entitySet, view, { query, closeAfterExisting: true }, err => {
            // let source = this.source({ closeAfterExisting: true });
            // let sink = view.sink({}, err => {
            // console.log('[EntitySetAsyncView]', 'initial pull closed', err);

            // problem: the streamIn is creating events that the streamOut picks up on
            // and echoes back to the source. how to stop those events going back to source.
            // and of course we dont want to stop all events from the view

            // create the stream which will deliver continuous updates
            view.streamIn = createUpdateStream(entitySet, view, { ...options, query, sendExisting: false });

            // ensure that any updates from the view get back to the entitySet
            view.streamOut = createUpdateStream(view, entitySet, { ...options, sendExisting: false });

            resolve(view);
        });
    });
}

/**
 *
 * @param {*} query
 * @param {*} options
 */
EntitySet.prototype.createView = function(query, options = {}) {
    return create(this, query, options);
};

/**
 *
 */
EntitySetAsyncView.prototype.applyEvents = function() {};

/**
 * Creates a pull-stream from the source to the destination
 *
 * @param {*} entitySet
 * @param {*} view
 */
function createUpdateStream(origin, target, options, completeCb) {
    // console.log('[EntitySetAsyncView][createUpdateStream]', 'from', origin.cid, 'to', target.cid );
    // let source = origin.source(options);
    // let sink = target.sink({}, completeCb);
    options = { ...options, emitEntities: true };

    let args = [origin.source(options)];

    if (options.debug) {
        args.push(
            PullMap(val => {
                let [data, dataOptions] = val;
                console.log('[EntitySetAsyncView][>]', origin.cid, target.cid, stringify(data));
                return val;
            })
        );
    }

    if (options.query) {
        args.push(QueryFilter(options.query, options));
    }

    args.push(target.sink({ source: origin }, completeCb));

    return Pull.apply(null, args);
}

EntitySetAsyncView.prototype.type = 'EntitySetAsyncView';
EntitySetAsyncView.prototype.isMemoryEntitySet = true;
EntitySetAsyncView.prototype.isEntitySetView = true;
