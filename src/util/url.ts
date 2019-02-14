

export interface UrlResult {
    url: string;
    protocol: string;
    username: string;
    password: string;
    host: string;
    port: number;
    pathname: string;
    querystring: string;
    fragment: string;
    hash: string;
}

/**
 * https://gist.github.com/metafeather/202974
 * 
 * @param {*} url 
 */
export function parseUrl( url:string ) : UrlResult {
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
        port: parseInt( r[10], 10 ),
        pathname: r[11] || "",
        querystring: r[14] || "",
        fragment: r[16] || "",
        hash: r[16] || "",
    };
}