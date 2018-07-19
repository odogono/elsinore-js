

/**
 * https://gist.github.com/metafeather/202974
 * 
 * @param {*} url 
 */
export function parseUrl( url ){
    if( !url ){
        return null;
    }
    
    let r = url.match(/^((\w+):)?(\/\/((\w+)?(:(\w+))?@)?([^\/\?:]+)(:(\d+))?)?(\/?([^\/\?#][^\?#]*)?)?(\?([^#]+))?(#([\w\-]*))?/);
    return {
        url: r[0],
        protocol: r[2],
        username: r[5],
        password: r[7],
        host: r[8] || "",
        port: r[10],
        pathname: r[11] || "",
        querystring: r[14] || "",
        fragment: r[16] || "",
        hash: r[16] || "",
    };
}