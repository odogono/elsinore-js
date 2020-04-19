import { isEmpty } from "./is";

/**
 * Capitalises a string
 * 
 */
export function toCapitalized( str:string ): string {
    return isEmpty(str) ? str : str.charAt(0).toUpperCase() + str.substring(1);
}

export function toKebabCase(str:string, joinChar:string = '-'): string {
    return str
        .match(/[A-Z]?[a-z]+/g)
        .map( word => word.toLowerCase() ) // word.charAt(0).toUpperCase() + word.substring(1) )
        .join(joinChar);
}

export function toSnakeCase(str:string): string {
    return toKebabCase(str, '_');
}

/**
 *   Converts a string so that the words are CapitalisedAndConcatenated
 */
export function toPascalCase(str:string, joinChar:string = ''): string {
    return str
        .match(/[A-Z]?[a-z]+/g)
        .map( word => toCapitalized(word) ) // word.charAt(0).toUpperCase() + word.substring(1) )
        .join(joinChar);
}

/**
*   Converts a string so that the words are capitalisedAndConcatenated
*/
export function toCamelCase(str: string, joinChar: string = ''): string {
    let result = toPascalCase(str,joinChar);
    return result.charAt(0).toLowerCase() + result.substring(1);
}



export const objectKeysToCamelCase = obj => {
    return Object.keys(obj).reduce((memo, key) => {
        memo[toCamelCase(key)] = obj[key];
        return memo;
    }, {});
};
