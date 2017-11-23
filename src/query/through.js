import Component from '../component';
import Entity from '../entity';
import Query from './index';
import {entityToString} from '../util/to_string';

/**
 * passes entities through a queryfilter
 * 
 * @param {*} query 
 */
export default function queryFilter(query) {
    query = new Query(query);
    
    const test = (val) => {
        const isComponent = Component.isComponent(val);
        const isEntity = Entity.isEntity(val);

        // console.log('[QueryFilter] consider', isEntity, isComponent, val );
        
        // components pass right through the queryFilter - queries only apply
        // to entities after all
        // this was readded to cater for views which need to cope with components
        // being added/removed from existing entities
        if( isComponent ){
            return true;
        }

        if( val['@cmd'] ){
            return true;
        }

        // not an entity either - so reject
        if( !isEntity ){
            // console.log('[QueryFilter] rejecting', isEntity, isComponent, val );
            return true;
        }

        let outcome = query.execute( val );

        if( Entity.isEntity(outcome) && outcome.hasComponents() ){
            return true;
        }

        return false;
    };

    return function(read) {
        return function next(end, cb) {
            let sync, loop = true;
            while (loop) {
                loop = false;
                sync = true;
                read(end, function(end, data) {
                    
                    if (!end && !test(data))
                        return sync ? loop = true : next(end, cb);
                    cb(end, data);
                });
                sync = false;
            }
        };
    };
}
