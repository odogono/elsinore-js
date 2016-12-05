import _ from 'underscore';

let logActive = true;



export function createLog(name,active=true){
    let fn = {};

    if( process.env.NO_LOG || !logActive || !active || !console ){
        ['debug','info','log','warn','error'].forEach( l => fn[l] = ()=>{} );
    }
    else {
        for( const m in console ){
            if(typeof console[m] == 'function'){
                fn[m] = console[m].bind(console, `[${name}:${m}]`);
            }
        }
        if(!fn.debug){
            fn.debug = console.log.bind(console, `[${name}:debug]`);
        }
    }
    return fn;
}

export function setActive(isit=true){
    logActive = isit;
}