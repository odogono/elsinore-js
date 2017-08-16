import Entity from '../entity';
import Query from './index';
import {entityToString} from '../util/to_string';

/**
 * passes components through a queryfilter
 * 
 * @param {*} query 
 */
export default function queryFilter(query) {
    query = new Query(query);
    
    const test = (val) => {
        if( !Entity.isEntity(val) ){
            return false;
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
