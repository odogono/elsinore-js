import { toPascalCase } from './to';

/**
 * 
 */
export default function componentNameFromUri(schemaUri, suffix = '') {
    let name = schemaUri.split('/').pop();
    return toPascalCase(name + suffix);
}
