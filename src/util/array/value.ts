import { isCollection, isComponent, isEntity } from '../is';

/**
 * If the passed array has only a single value, return
 * that value, otherwise return the array
 * 
 * @param {*} array
 * @returns {(*|[])} 
 */
export function valueArray(...array) {
    if (array === undefined) {
        return null;
    }
    
    if (array.length > 0) {
        array = array.reduce((acc, cur) => {
            if ( isCollection(cur)) {
                cur = cur.models;
            }
            if( Array.isArray(cur) ){
                return [].concat.apply(acc, cur);
            } else {
                return acc.concat(cur);
            }
        }, []);
    }

    if( array.length === 0){
        return null;
    }
    // if only a single value, then return that
    if (array.length === 1) {
        return array[0];
    }

    return array;
}



/**
 * Returns all the components from a given array of collections
 * 
 * @param {*} entities 
 */
export function componentsFromCollections(...collections){
    let result = [];

    for( let ii=0;ii<collections.length;ii++ ){
        let models = collections[ii].models;
        for( let jj=0;jj<models.length;jj++ ){
            let item = models[jj];
            if( isComponent(item) ){
                result.push(item);
            } else if( isEntity(item) ){
                result = result.concat( models[jj].getComponents() );
            }
        }
    }

    // if only a single value, then return that
    if (result.length === 0) {
        return null;
    }

    if (result.length === 1) {
        return result[0];
    }

    return result;
}