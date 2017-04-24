export function toBoolean(value, defaultValue = false) {
    switch (value) {
        case true:
        case 'true':
        case 1:
        case '1':
        case 'yes':
            return true;
        case false:
        case 'false':
        case 0:
        case '0':
        case 'no':
            return false;
        default:
            return defaultValue;
    }
}

/**
 * Converts a value to an integer - well as much as that
 * means in JS.
 * If the value is not convertible, the supplied defaultValue
 * will be returned
 */
export function toInteger(value, defaultValue = 0) {
    if (isNaN(value)) {
        value = defaultValue;
    }
    return value < 0 ? Math.ceil(value) : Math.floor(value);
}


/**
*   Converts a string so that the words are capitalised and concatenated
*/
export function toPascalCase(str) {
    return str.match(/[A-Z]?[a-z]+/g).map(function(word) {
        return word.charAt(0).toUpperCase() + word.substring(1);
    }).join('');
    // return str.replace(/([A-Z]?[a-z]+)/gi, function(m,word){
    // doesn't deal with the delimiters...
    // return word.charAt(0).toUpperCase() + word.substring(1);
    // });
    // return Classify( str );
}