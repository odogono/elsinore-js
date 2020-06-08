import { createLog } from "../util/log";
import { EntitySetIDB, ComponentDefIDB, getEntity } from ".";

import {
    create as createStack,
    SType,
    addWords,
    pushValues,
    QueryStack,
    StackValue,
    InstResult, AsyncInstResult,
    push, pop, peek, pushRaw,
    findV,
    find as findValue,
    StackError,
    isStackValue,
    entityIdFromValue,
    popBitField,
} from "../query/stack";
import { onComponentAttr, buildBitfield } from "../entity_set/query";
import { onDefine, onPluck, unpackStackValueR, unpackStackValue } from "../query/words";
import { onLogicalFilter, parseFilterQuery } from "../entity_set/filter";
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
import { isInteger } from "../util/is";
import { Entity, EntityId, getEntityId, isEntity } from "../entity";
import { idbRetrieveEntityByDefId, idbRetrieveComponent, idbRetrieveComponents, idbRetrieveByQuery, idbRetrieveEntities } from "./idb";
import { ComponentDefId } from "../component_def";

const Log = createLog('IDBQuery');


interface IDBQueryStack extends QueryStack {
    es: EntitySetIDB
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(es: EntitySetIDB, query: StackValue[], options = {}): Promise<StackValue[]> {
    let stack = createStack() as IDBQueryStack;
    stack.es = es;

    // Log.debug('[select]', stack );

    if( 'stack' in options ){
        stack._root = stack._parent = options['stack'];
    }

    // add first pass words
    stack = addWords<IDBQueryStack>(stack, [
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

    [stack] = await pushValues(stack, query);

    // reset stack items and words
    let {items} = stack;
    stack.items = [];
    stack.words = {};

    // Log.debug('[select]', stack );

    // add 2nd pass words
    stack = addWords<IDBQueryStack>(stack, [
        ['@e', fetchEntity],
        // ['@v', fetchValue],
        ['@c', fetchComponents, SType.Entity, 'all' ],
        ['@c', fetchComponents, SType.List, SType.Bitfield ],
        ['@c', fetchComponents, SType.Entity, SType.Bitfield ],
        ['@c', fetchComponents, 'all' ],
        ['@c', fetchComponents, SType.Bitfield ],
        ['@c', fetchComponents, SType.List ],
        ['@c', fetchComponents, SType.Entity ],
        ['!fil', applyFilter, SType.Filter],

        ['limit', applyLimit],
        ['pluck', onPluck, SType.List, SType.Value],
        ['pluck', onPluck, SType.List, SType.List],
    ]);

    // make sure any filter values have a following cmd
    items = items.reduce( (result, value, ii, items) => {
        if( value[0] === SType.Filter ){
            return [...result, value, '!fil'];
        }
        return [...result,value];
    },[]);

    // Log.debug('pushing ', items);
    [stack] = await pushValues(stack, items);

    return stack.items;
}



export async function applyFilter(stack:IDBQueryStack): AsyncInstResult<IDBQueryStack> {
    let filter;
    const {es} = stack;
    [stack, [,filter]] = pop(stack);

    // Log.debug('[applyFilter]', filter[2] );
    
    let result = parseFilterQuery( es, filter[0], filter[1], filter[2] );

    // Log.debug('[applyFilter]', result );
    
    let eids = await idbRetrieveByQuery( es.db, result );
    // Log.debug('[applyFilter]', 'result eids', eids );
    

    return [stack, [SType.List, eids.map(e => [SType.Entity,e]) ]];
}



export async function fetchComponents(stack: IDBQueryStack): AsyncInstResult<IDBQueryStack> {
    const {es} = stack;
    let left, right: StackValue;
    let eids:EntityId[];
    let dids:ComponentDefId[];

    
    // get the bitfield
    [stack, dids] = popBitField(stack,false) as [IDBQueryStack, ComponentDefId[]];
    
    left = peek(stack);
    
    if( left !== undefined ){
        let from;
        [stack,from] = pop(stack);
        // Log.debug('[fetchComponents]', from );
        if( from[0] === SType.Entity ){
            eids = [unpackStackValueR(from)];
        } else if( from[0] === SType.List ){
            eids = from[1].map( it => {
                return isStackValue(it) ? getEntityId(it[1])
                : isEntity(it) ? getEntityId(it) : undefined;
            }).filter(Boolean);
        }
    }
    
    let coms = [];
    // Log.debug('[fetchComponent]', 'good', eids, dids );
    
    coms = await idbRetrieveComponents( es.db, eids, dids );
    // coms = sqlRetrieveComponents(es.db, eids, defs || es.componentDefs);

    // Log.debug('[fetchComponent]', 'coms', coms );

    return [stack, [SType.List, coms.map(c => [SType.Component,c] )]];
}


/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: IDBQueryStack): AsyncInstResult<IDBQueryStack> {
    const {es} = stack;
    let data: StackValue;
    [stack, data] = pop(stack);

    const type = data[0];
    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    let eids: EntityId[];

    // Log.debug('[fetchEntity]', 'eh?', data);

    if (type === SType.Bitfield) {
        bf = eid as BitField;
        let ents = await matchEntities(es, bf);
        return [stack, [SType.List, ents]];
    } else if (isInteger(eid)) {
        let e = getEntity(es,eid,false);
        // Log.debug('[fetchEntity]', es.entities);
        if (e === undefined) {
            return [stack, [SType.Value, false]];
        }
        return [stack, [SType.Entity, eid]];
    }
    else if( Array.isArray(eid) ){
        eids = eid;
    }
    else if (type === SType.List) {
        let arr = unpackStackValue(data, SType.List, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
    }
    else if( eid === 'all' ){
        let ents = await matchEntities(es);
        return [stack, [SType.List, ents]];
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    let ents = await idbRetrieveEntities( es.db, eids );

    let result = ents.map( e => [SType.Entity, getEntityId(e)] );

    // let result = [];
    // for(const eid of eids ){
    //     let e = await getEntity(es, eid, false);
    //     result.push( e === undefined ? [SType.Value, false] : [SType.Entity,eid]);
    // }

    // let result = eids.map(eid => getEntity(es,eid, false) )
    // .map(eid => eid === undefined ? [SType.Value, false] : [SType.Entity,eid]);

    return [stack, [SType.List, result]];
}


export function applyLimit(stack: IDBQueryStack): InstResult<IDBQueryStack> {
    let limit, offset;
    [stack, limit] = pop(stack);
    [stack, offset] = pop(stack);

    return [stack];
}


function matchEntities(es: EntitySetIDB, mbf?: BitField): Promise<Entity[]> {
    if( mbf === undefined ){
        return Promise.resolve([]);
        // return sqlRetrieveEntities(es.db);
    }
    // Log.debug('[matchEntities]', bfToValues(mbf));
    // return [];
    return idbRetrieveEntityByDefId(es.db, bfToValues(mbf));
}

function ilog(...args){
    if( process.env.JS_ENV === 'browser' ){ return; }
    const util = require('util');
    console.log( util.inspect( ...args, {depth:null} ) );
}