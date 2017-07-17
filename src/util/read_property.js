/**
 * Returns the given property from the object, or returns a
 * default if the property does not exist
 * 
 * @param {object} obj
 * @param {string} name
 * @param defaultTo
 * @return {object}
 */
export default function readProperty(obj, name, defaultTo = undefined) {
    let result;

    if (Array.isArray(name)) {
        let pathResults = name.map(p => obj[p]);

        // pick the first non-undefined value
        result = pathResults.find(r => r !== undefined);
    } else {
        result = obj[name];
    }

    if (result === undefined) {
        result = defaultTo;
    }

    return result;
}