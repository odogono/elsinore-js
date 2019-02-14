import { arrayDifference } from './difference';

/**
 * Returns an array without the given other element
 */
export function arrayWithout<T>(array:Array<T>, other:(Array<T>|any)) : Array<T> {
    if( !Array.isArray(other) ){
        return array.filter(x => x !== other );
    }
    return arrayDifference(array, other);
}