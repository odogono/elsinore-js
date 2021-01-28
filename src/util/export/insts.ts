import Fs from 'fs-extra';
import { Component, getComponentDefId, toObject } from '../../component';
import { ComponentDef, toShortObject } from '../../component_def';
import { EntitySet } from "../../entity_set";
import { stringify } from '../json';


const log = (...args) => console.log('[ExportInsts]', ...args);

export interface ExportOptions {
    path: string;
    retainEid?: boolean;
}

export async function exportEntitySet( es:EntitySet, options:ExportOptions ){
    const { path, retainEid } = options;
    let buffer = [];

    // select defs
    const defs = await es.getComponentDefs();

    for( const def of defs ){
        buffer.push( `${defToString(def)} !d` );
    }

    if( defs.length > 0 ){
        buffer.push('gather'); // wrap in list
        buffer.push('+'); // add to es
        buffer.push('');
    }

    let eids = await es.getEntities();
    eids.sort();

    for( const eid of eids ){
        // [ /component/src {url: "file:///readme.txt"} ] !c

        const e = await es.getEntity(eid, true);

        for( const com of e.components.values() ){
            buffer.push(`${comToString(es,com)} !c`);
        }

        buffer.push('gather'); // wrap in list
        if( retainEid ){
            buffer.push(`${e.id} !e swap +`);
        } else {
            buffer.push('+'); // add to es
        }
        buffer.push('');

    }
    
    return buffer.join('\n');
}


function comToString( es:EntitySet, com:Component ){
    let out = [];
    const defId = getComponentDefId(com);
    const def = es.getByDefId(defId);

    out.push( `[ ${def.uri} {`);

    
    for( let key of Object.keys(com) ){
        if( key === '@e' || key === '@d' ){
            continue;
        }
        out.push( `${key}: ${stringify(com[key])}`);
    }
    

    out.push('} ]');
    

    return out.join(' ');
}

function defToString( def:ComponentDef ){
    const [uri, props] = toShortObject( def );
    let out = [];

    out.push( `[ ${stringify(uri)}`);
    out.push('[');
    for( const prop of props ){
        if( Object.keys(prop).length === 1 && prop.name ){
            out.push( stringify(prop.name))
        } else {
            out.push('{');
            
            for( const [k,v] of Object.entries(prop) ){
                out.push( `${stringify(k)}: ${stringify(v)}` );
            }

            out.push('}');
        }
        
    }
    out.push(']');
    out.push( ']' );

    return out.join(' ');
}