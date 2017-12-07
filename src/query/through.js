import Component from '../component';
import Entity from '../entity';
import Query from './index';
import { toString as entityToString } from '../util/to_string';

/**
 * passes entities through a queryfilter
 *
 * @param {*} query
 */
export default function queryFilter(query, options = {}) {
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
    if( !query ){
        return true;
    }
    // console.log('[applyQueryFilter]', 'hey ho', value);
    // if( Array.isArray(val) ){
    //     val = val[0];
    // }
    const isComponent = Component.isComponent(value);
    const isEntity = Entity.isEntity(value);

    // console.log('[QueryFilter] consider', isEntity, isComponent, (value) );

    // components pass right through the queryFilter - queries only apply
    // to entities after all
    // this was readded to cater for views which need to cope with components
    // being added/removed from existing entities
    if (isComponent) {
        return true;
    }

    if (value['@cmd']) {
        return true;
    }

    // not an entity either - so reject
    if (!isEntity) {
        // console.log('[QueryFilter] rejecting', isEntity, isComponent, value );
        return true;
    }

    let outcome = query.execute(value);

    if (Entity.isEntity(outcome) && outcome.hasComponents()) {
        return true;
    }

    return false;
}
