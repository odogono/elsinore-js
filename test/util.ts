import { assert } from 'chai';
import Jsonpointer from 'jsonpointer';
import { isString, isObject } from 'util';




describe('Utils', () => {

    it('dehydrates an object', async () => {

        let result = dehydrate(data);

        Jsonpointer.get( data, '/images/bg');

        ilog( result );
    });
})


/**
 * 
 * @param obj 
 */
function dehydrate( obj:object ){
    let result = [];

    walk( obj, [], result );
    
    return result;
}


function walk( obj, path:string[], result:any[] ){
    if( Array.isArray(obj) ){
        for( let ii=0;ii<obj.length;ii++ ){
            let spath = [...path, String(ii) ];
            [spath,result] = walk( obj[ii], spath, result );
        }
    }
    else if( isObject(obj) ){
        for( const key in obj ){
            if( !obj.hasOwnProperty(key) ){ continue; }
            let spath = [...path, key];
            [spath,result] = walk( obj[key], spath, result );
        }
    }
    else {
        result.push( [ '/' + path.join('/'), obj ] );
    }

    return [path, result];
}


const data = {
    "name": "DMS",
    "companyId": 139,
    
    "images":{
        "bg": "https://m.zentrack.co.uk/static/media/native/bg.zt.jpg",
        "title":"https://m.zentrack.co.uk/static/media/native/dms.384.png",
        "default":"https://m.zentrack.co.uk/static/media/native/logo.zt.512.png"
    },
    "style":{
        "login":{
            "panel":{
                "backgroundColor": "#787891CC"
            }
        }
    },
    "tags": ["hello", "world"]
};


function ilog(...args) {
    if (process.env.JS_ENV !== 'browser') {
        const util = require('util');
        console.log(util.inspect(...args, { depth: null }));
    }
}