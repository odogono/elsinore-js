/**
 * Safe parsing of json data
 */
export function parseJSON(str:string, defaultValue:any = null) : any {
    try {
        return JSON.parse(str);
    } catch (err) {
        return defaultValue;
    }
}