import Jsonpointer from 'jsonpointer';
import {isObject} from './is';

/**
 * Safe parsing of json data
 */
export function parseJSON(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (err) {
        return defaultValue;
    }
}



/**
 * Converts the value to a JSON string
 */
export function stringify(obj:any, space?:(number|string)) : string {
    let cache:Array<any> = [];
    return JSON.stringify(
        obj,
        (key, value:any) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Circular reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        },
        space
    );
}


export type DehydrateResult = [ string, any ];

/**
 * takes an array of JSON pointer paths to values and produces an
 * object
 * 
 * @param parts 
 * @param obj 
 */
export function rehydrate( parts:DehydrateResult[], obj:object ){
    for( const [ptr,val] of parts ){
        Jsonpointer.set(obj, ptr, val);
    }
    return obj;
}





/**
 * takes an object and produces an array of JSON pointer paths to values
 * 
 * @param obj 
 */
export function dehydrate( obj:object ):DehydrateResult[] {
    let result:DehydrateResult[] = [];

    dehydrateWalk( obj, [], result );
    
    return result;
}


function dehydrateWalk( obj:any, path:string[], result:any[] ){
    if( Array.isArray(obj) ){
        for( let ii=0;ii<obj.length;ii++ ){
            let spath = [...path, String(ii) ];
            [spath,result] = dehydrateWalk( obj[ii], spath, result );
        }
    }
    else if( isObject(obj) ){
        for( const key in obj ){
            if( !obj.hasOwnProperty(key) ){ continue; }
            let spath = [...path, key];
            [spath,result] = dehydrateWalk( obj[key], spath, result );
        }
    }
    else {
        result.push( [ '/' + path.join('/'), obj ] );
    }

    return [path, result];
}
