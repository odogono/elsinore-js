import { EntityId,  getEntityId, isEntity } from "../entity";
import {
    toComponentId, 
    getComponentDefId, 
    getComponentEntityId 
} from "../component";
import { createLog } from "../util/log";
import { isObject, isInteger, isString, isBoolean } from "../util/is";
import { 
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    and as bfAnd,
    or as bfOr,
    toValues as bfToValues
} from "../util/bitfield";
import {
    isStackValue,
    entityIdFromValue,
    QueryStack,
} from "../query/stack";
import {
    SType,
    StackValue,
    InstResult, AsyncInstResult,
    StackError,
} from "../query/types";
import { onPluck } from "../query/words/pluck";
import { onDefine } from "../query/words/define";
import { ComponentDefId, getDefId, ComponentDef } from "../component_def";
import { onLogicalFilter, parseFilterQuery } from './filter';
import { unpackStackValue, unpackStackValueR } from "../query/util";
import { EntitySetMem } from ".";

const Log = createLog('ESMemQuery');


class ESMemQueryStack extends QueryStack {
    es: EntitySetMem
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(es: EntitySetMem, query: StackValue[], options = {} ): Promise<StackValue[]> {
    let stack = new ESMemQueryStack();
    stack.es = es;
    if( 'stack' in options ){
        stack._root = stack._parent = options['stack'];
    }
    
    // add first pass words
    stack.addWords([
        ['!bf', buildBitfield, SType.List],
        ['!bf', buildBitfield, SType.Value],
        ['!ca', onComponentAttr],
        ['define', onDefine],
        
        ['and', onLogicalFilter, SType.Any, SType.Any],
        ['or', onLogicalFilter, SType.Any, SType.Any],
        ['not', onLogicalFilter, SType.Any, SType.Any],
        ['==', onLogicalFilter, SType.Any, SType.Any],
        ['!=', onLogicalFilter, SType.Any, SType.Any],
    ]);


    // Log.debug('[select]', query );

    await stack.pushValues(query);

    // reset stack items and words
    let {items} = stack;
    stack.items = [];
    stack.words = {};


    stack.addWords([
        ['@e', fetchEntity],
        ['@c', fetchComponents],
        ['!fil', applyFilter, SType.Filter],

        ['limit', applyLimit],
        ['pluck', onPluck],
    ]);

    // make sure any filter values have a following cmd
    items = items.reduce( (result, value, ii, items) => {
        if( value[0] === SType.Filter ){
            return [...result, value, '!fil'];
        }
        return [...result,value];
    },[]);

    // Log.debug('pushing ', items);
    await stack.pushValues(items);

    // Log.debug('[select]', stackToString(stack) );


    return stack.items;
}


export function applyFilter(stack:ESMemQueryStack): InstResult {
    let filter;
    const {es} = stack;
    [,filter] = stack.pop();
    
    // DLog(stack._root, 'bugger', filter);
    // ilog(filter);
    let result = parseFilterQuery( es, filter[0], filter[1], filter[2] );
    // Log.debug('[applyFilter]', result );
    
    let eids = walkFilterQuery( es, Array.from(es.entities.keys()), ...result ).sort();
    // Log.debug('[applyFilter]', 'result eids', eids );

    return [SType.List,eids.map(eid => [SType.Entity,eid])];
}

function walkFilterQuery( es:EntitySetMem, eids:EntityId[], cmd?, ...args ){
    if( cmd === 'and' ){
        let left = walkFilterQuery( es, eids, ...args[0] );
        if( left === undefined || left.length === 0 ){
            return left;
        }

        // if there are no results, then return
        let right = walkFilterQuery(es, left, ...args[1] );
        return right;
    }
    else if( cmd === 'or' ){
        let left = walkFilterQuery( es, eids, ...args[0] );
        let right = walkFilterQuery( es, eids, ...args[1] );

        // merge the results and return
        return [...new Set([...left ,...right])];
    }
    else if( cmd === '==' ){
        let {def} = args[0];
        const did = getDefId(def);
        let [key,val] = args[1];
        eids = matchEntities(es, eids, createBitField([did]));
        eids = eids.reduce( (out,eid) => {
            const cid = toComponentId(eid,did);
            const com = es.components.get(cid);
            
            // if( com[key] === val )
            // Log.debug('[walkFQ]','==', key, val, com[key], com);
            // if the value is an array, we look whether it exists
            if( Array.isArray(val) ){
                return val.indexOf( com[key] ) !== -1 ? [...out,eid] : out;
            }
            // otherwise a straight compare
            return com[key] === val ? [...out,eid] : out;
        },[]);

        // Log.debug('[walkFQ]', def.uri, key, '==', val);
        return eids;
    } else {
        Log.debug('[walkFQ]', `unhandled ${cmd}`);
        return eids;
    }
}


export function applyLimit(stack: ESMemQueryStack): InstResult {
    let limit = stack.pop();
    let offset = stack.pop();

    return undefined;
}

export function fetchValue(stack: ESMemQueryStack): InstResult {
    let arg: StackValue = stack.pop();
    let type = arg[0];
    let value;

    if (type === SType.List) {
        value = unpackStackValue(arg);
        value = value.map(v => [SType.Value, v]);
        value = [SType.List, value];
    }

    return value;
}




export function fetchComponents(stack: ESMemQueryStack): InstResult {
    const {es} = stack;
    let left: StackValue;
    let eids:EntityId[];
    let dids:ComponentDefId[];
    let coms = [];

    // get the bitfield
    dids = stack.popBitField<ComponentDef>(false) as ComponentDefId[];

    
    left = stack.peek();

    if( left !== undefined ){
        let from = stack.pop();
        if( from[0] === SType.Entity ){
            eids = [unpackStackValueR(from)];
        } else if( from[0] === SType.List ){
            // Log.debug('[fetchComponent]', from[1]);          
            eids = from[1].map( it => {
                return isStackValue(it) ? getEntityId(it[1])
                : isEntity(it) ? getEntityId(it) : undefined;
            }).filter(Boolean);
        } else {
            Log.debug('[fetchComponent]', 'unhandled', from);
        }
    }

    // Log.debug('[fetchComponent]', eids, dids );

    // if an empty eid array has been passed, then no coms can be selected
    if( eids !== undefined && eids.length === 0 ){
        return [SType.List, coms];
    }

    // Log.debug('[fetchComponent]', eids, dids );
    
    
    if( dids !== undefined && dids.length > 0 ){
        for( const [,com] of es.components ){
            if( dids.indexOf( getComponentDefId(com) ) !== -1 ){
                coms.push(com);
            }
        }
    } else {
        coms = Array.from( es.components.values() );
    }

    if( eids !== undefined && eids.length > 0 ){
        coms = coms.filter(com => eids.indexOf( getComponentEntityId(com)) !== -1 );
    }

    // sort by entityId
    coms.sort( (a,b) => a['@e'] - b['@e'] );

    coms = coms.map(c => [SType.Component, c]);
   
    return [SType.List, coms];
}


/**
 * Builds a ComponentAttr value - [Bitfield,string]
 * 
 * @param es 
 * @param stack 
 */
export function onComponentAttr(stack: QueryStack): InstResult {
    const {es} = stack;
    let right:StackValue = stack.pop();
    let left:StackValue = stack.pop();

    let attr = unpackStackValue(right, SType.Value);
    let dids = unpackStackValue(left, SType.Any);
    dids = isString(dids) ? [dids] : dids;

    let bf = es.resolveComponentDefIds(dids );

    if( bfCount(bf) === 0 ){
        throw new StackError(`def not found: ${left}`);
    }


    return [SType.ComponentAttr, [bf, attr]];
}

export function buildBitfield(stack: QueryStack): InstResult {
    const {es} = stack;
    let arg: StackValue = stack.pop();
    
    let dids = unpackStackValueR(arg, SType.Any);
    dids = isString(dids) ? [dids] : dids;
    let bf = es.resolveComponentDefIds(dids);

    return [SType.Bitfield, bf];
}

/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: ESMemQueryStack): AsyncInstResult {
    const {es} = stack;
    let data: StackValue = stack.pop();
    
    const type = data[0];
    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    let eids: number[];

    // Log.debug('[fetchEntity]', 'eh?', data);

    if (type === SType.Bitfield) {
        bf = eid as BitField;
        eids = matchEntities(es, undefined, bf);
    } else if (isInteger(eid)) {
        let e = await es.getEntity(eid,false);
        // Log.debug('[fetchEntity]', es.entities);
        if (e === undefined) {
            return [SType.Value, false];
        }
        return [SType.Entity, eid];
    }
    else if( Array.isArray(eid) ){
        eids = eid;
    }
    else if (type === SType.List) {
        let arr = unpackStackValue(data, SType.List, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
    }
    else if( eid === 'all' ){
        let ents = matchEntities(es, undefined, 'all');
        return [SType.List, ents];
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    let ents = es.getEntitiesMem(eids);
    let result = ents.filter(Boolean).map( e => [SType.Entity,e] );

    // let result = [];
    // for( const eid of eids ){
    //     const e = await es.getEntity(eid, false);
    //     result.push( e === undefined ? [SType.Value,false] : [SType.Entity,e] );
    // }

    return [SType.List, result];
}



function matchEntities(es:EntitySetMem, eids: EntityId[], mbf: BitField|'all'): EntityId[] {
    let matches: number[] = [];
    const isAll = mbf === 'all' || mbf.isAllSet;// bf.toString() === 'all';
    if( isAll ){
        return eids !== undefined ? eids : Array.from(es.entities.keys());
    }
    if( eids === undefined ){
        // let es = from as EntitySetMem;
        for (let [eid, ebf] of es.entities) {
            if (bfAnd(mbf as BitField, ebf)) {
                matches.push(eid);
            }
        }
    } else {
        for( let ii=0;ii<eids.length;ii++ ){
            let eid = eids[ii];
            let ebf = es.entities.get(eid);
            if( bfAnd( mbf as BitField, ebf) ){
                matches.push(eid);
            }
        }
    }
    
    // sort ascending
    matches.sort();
    
    return matches;
}



// function matchEntitiesII(es: EntitySetMem, mbf: BitField): EntityList {
//     let matches = [];
//     // let entities = new Map<number,BitField>();
//     // let {returnEntities, limit} = options;
//     // limit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;

//     const isAll = BitField.isAllSet(mbf);// mbf.toString() === 'all';
//     for (let [eid, ebf] of es.entities) {
//         if (isAll || BitField.and(mbf, ebf)) {
//             matches.push(eid);
//         }
//     }
//     return createEntityList(matches, mbf);
// }

function ilog(...args){
    if( process.env.JS_ENV === 'browser' ){ return; }
    const util = require('util');
    console.log( util.inspect( ...args, {depth:null} ) );
}