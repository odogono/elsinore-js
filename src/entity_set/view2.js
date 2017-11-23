import EntitySet from './index';
import Pull from 'pull-stream';
import PullMap from 'pull-stream/throughs/map';
import Query from '../query';

import stringify from '../util/stringify';
import QueryFilter from '../query/through';

export function EntitySetView(entities, options = {}) {
    EntitySet.call(this, entities, options);
}

EntitySet.prototype.createView = function(query, options = {}) {
    let registry = this.getRegistry();

    query = Query.toQuery(query);
    this._views || (this._views = {});

    let queryId = query ? query.hash() : 'all';
    let existing = this._views[queryId];

    if (existing) {
        return existing;
    }

    let view = registry.createEntitySet({ type: EntitySetView, register: false });
    view._parent = this;
    this._views[queryId] = view;

    this.emit('view:create', view);

    return new Promise((resolve, reject) => {
        // the first update stream sends all the existing entities and then closes
        createUpdateStream(this, view, { query, closeAfterExisting: true }, err => {
            // let source = this.source({ closeAfterExisting: true });
            // let sink = view.sink({}, err => {
            // console.log('[EntitySetView]', 'initial pull closed', err);

            // create the stream which will deliver continuous updates
            view.streamIn = createUpdateStream(this, view, { query, debug: false, sendExisting: false });

            // ensure that any updates from the view get back to the entitySet
            view.streamOut = createUpdateStream( view, this, {sendExisting:false} );

            resolve(view);
        });
    });
};

/**
 * Creates a pull-stream from the source to the destination
 * 
 * @param {*} entitySet 
 * @param {*} view 
 */
function createUpdateStream(origin, target, options, completeCb) {
    // let source = origin.source(options);
    // let sink = target.sink({}, completeCb);
    options = {...options, emitEntities: true};

    let args = [origin.source(options)];
    
    if (options.debug) {
        args.push(
            PullMap(val => {
                console.log('[EntitySetView][>]', stringify(val));
                return val;
            })
        );
    }

    if( options.query ){
        args.push( QueryFilter(options.query) );
    }

    args.push(target.sink({}, completeCb));

    return Pull.apply(null, args);
}

Object.assign(EntitySetView.prototype, EntitySet.prototype, {});

EntitySetView.prototype.type = 'EntitySetView';
EntitySetView.prototype.isMemoryEntitySet = true;
EntitySetView.prototype.isEntitySetView = true;
