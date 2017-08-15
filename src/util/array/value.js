import Collection from '../collection';

/**
*   If the passed array has only a single value, return
*   that value, otherwise return the array
*/
export default function valueArray(...array) {
    if (array === undefined) {
        return null;
    }

    if( array.length > 0 ){
        array = array.reduce( (acc,cur) => {
            if( cur instanceof Collection ){
                cur = cur.models;
            }
            return acc.concat( cur );
         }, []);
    }
    
 
    if (array.length === 1) {
        array = array[0];
    }

    return array;
}