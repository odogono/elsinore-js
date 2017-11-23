import Collection from '../collection';
import Entity from '../../entity';
import Component from '../../component';


/**
 * If the passed array has only a single value, return
 * that value, otherwise return the array
 * 
 * @param {*} array
 * @returns {(*|[])} 
 */
export default function valueArray(...array) {
    if (array === undefined) {
        return null;
    }
    
    
    if (array.length > 0) {
        array = array.reduce((acc, cur) => {
            if (cur instanceof Collection) {
                cur = cur.models;
            }
            return acc.concat(cur);
        }, []);
    }

    // if only a single value, then return that
    if (array.length === 1) {
        array = array[0];
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
            if( Component.isComponent(item) ){
                result.push(item);
            } else if( Entity.isEntity(item) ){
                result = result.concat( models[jj].getComponents() );
            }
        }
    }

    // if only a single value, then return that
    if (result.length === 1) {
        result = result[0];
    }

    return result;
}