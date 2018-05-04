import { Component } from '../component';
import { Entity } from '../entity';
import { Query } from './index';
import { toString as entityToString } from '../util/to_string';

import { COMMAND } from '../constants';


/**
 * passes entities through a queryfilter
 *
 * @param {*} query
 */
export function QueryFilter(query, options = {}) {
    query = new Query(query);

    // the incoming stream will be [(entity|component),options]
    // the options passed with contain an (es) origin cid

    return function(read) {
        return function next(end, cb) {
            let sync,
                loop = true;
            while (loop) {
                loop = false;
                sync = true;
                read(end, function(end, data) {
                    // the incoming data will normally be [value,valueOptions]
                    // if( !end ){ value = value[0]; }
                    if (!end && !applyQueryFilter(query, data[0], data[1])) {
                        return sync ? (loop = true) : next(end, cb);
                    }
                    cb(end, data);
                });
                sync = false;
            }
        };
    };
}

export function applyQueryFilter(query, value, options = {}) {
    if (!query) {
        return true;
    }
    const isComponent = Component.isComponent(value);
    const isEntity = Entity.isEntity(value);

    // components pass right through the queryFilter - queries only apply
    // to entities after all
    // this was readded to cater for views which need to cope with components
    // being added/removed from existing entities
    if (isComponent) {
        return true;
    }

    if (value[COMMAND]) {
        return true;
    }

    // not an entity either - so reject
    if (!isEntity) {
        // console.log('[QueryFilter] rejecting', isEntity, isComponent, value );
        return true;
    }

    let outcome = query.execute(value);

    // console.log('[QueryFilter] consider', isEntity, isComponent, JSON.stringify(outcome) );

    if (Entity.isEntity(outcome) && outcome.hasComponents()) {
        return true;
    }

    return false;
}

export function extractValue(options = {}) {
    return function(read) {
        return function next(end, cb) {
            // let sync,loop = true;
            // while(loop){
            // loop = false;
            // sync = true;
            read(end, function(end, data) {
                cb(end, data != null ? (Array.isArray(data) ? data[0] : data) : null);

                // if(!end){
                //     return sync ? (loop=true) : next(end,cb);
                // }
                // cb(end, data);//Array.isArray(data) ? data[0] : data );
            });
            // sync = false;
            // }
        };
    };
}
