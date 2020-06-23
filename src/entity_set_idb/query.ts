import { createLog } from "../util/log";
import { EntitySetIDB } from ".";

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
} from '../query/types';

import { onComponentAttr, buildBitfield, SelectOptions } from "../entity_set/query";
import { onLogicalFilter, parseFilterQuery } from "../entity_set/filter";
import { 
    BitField,
    toValues as bfToValues
} from "../util/bitfield";
import { isInteger } from "../util/is";
import { Entity, EntityId, getEntityId, isEntity } from "../entity";
import { idbRetrieveEntityByDefId, idbRetrieveComponents, idbRetrieveByQuery, idbRetrieveEntities } from "./idb";
import { ComponentDefId } from "../component_def";
import { unpackStackValueR, unpackStackValue } from "../query/util";
import { onPluck } from "../query/words/pluck";
import { onDefine } from "../query/words/define";
import { createStdLibStack } from '../../src/query';

const Log = createLog('IDBQuery');


class IDBQueryStack extends QueryStack {
    es: EntitySetIDB
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(stack:QueryStack, query: StackValue[], options:SelectOptions = {}): Promise<StackValue[]> {
    
    // stack.es = es;
    stack.setChild();


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
        ['>', onLogicalFilter, SType.Any, SType.Any],
        ['>=', onLogicalFilter, SType.Any, SType.Any],
        ['<', onLogicalFilter, SType.Any, SType.Any],
        ['<=', onLogicalFilter, SType.Any, SType.Any],
    ]);

    await stack.pushValues(query);

    // reset stack items and words
    let items = stack.items;
    stack.clear();

    // Log.debug('[select]', items );

    // add 2nd pass words
    stack.addWords( [
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

    await stack.pushValues(items);
    
    let result = stack.items;
    // Log.debug('pushing ', result);

    stack.restoreParent();
    
    return result;
}



export async function applyFilter(stack:IDBQueryStack): AsyncInstResult {
    let filter;
    const {es} = stack;
    [,filter] = stack.pop();

    // Log.debug('[applyFilter]', filter[2] );
    
    let result = parseFilterQuery( es, filter[0], filter[1], filter[2] );

    // Log.debug('[applyFilter]', result );
    
    let eids = await idbRetrieveByQuery( es.db, result );
    // Log.debug('[applyFilter]', 'result eids', eids );
    

    return [SType.List, eids.map(e => [SType.Entity,e]) ];
}



export async function fetchComponents(stack: IDBQueryStack): AsyncInstResult {
    const {es} = stack;
    let left, right: StackValue;
    let eids:EntityId[];
    let dids:ComponentDefId[];

    
    // get the bitfield
    dids = stack.popBitField(false) as ComponentDefId[];
    
    left = stack.peek();
    
    if( left !== undefined ){
        let from = stack.pop();
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

    return [SType.List, coms.map(c => [SType.Component,c] )];
}


/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: IDBQueryStack): AsyncInstResult {
    const {es} = stack;
    let data: StackValue = stack.pop();

    const type = data[0];
    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    let eids: EntityId[];
    let ents: Entity[];
    let returnSingle = false;

    // Log.debug('[fetchEntity]', 'eh?', data);

    if (type === SType.Bitfield) {
        bf = eid as BitField;
        ents = await matchEntities(es, bf);
        
    } else if (isInteger(eid)) {
        returnSingle = true;
        eids = [eid];
    }
    else if( Array.isArray(eid) ){
        eids = eid;
    }
    else if (type === SType.List) {
        let arr = unpackStackValue(data, SType.List, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
    }
    else if( eid === 'all' ){
        ents = await matchEntities(es);
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    if( ents === undefined ){
        ents = await idbRetrieveEntities( es.db, eids );
    }

    if( returnSingle ){
        let e = ents.length > 0 ? ents[0] : undefined;
        if (e === undefined) {
            return  [SType.Value, false];
        }
        return [SType.Entity, eid];
    }

    let result = ents.map( e => [SType.Entity, e] );
    // Log.debug('[fetchEntity]', 'by bf', ents);
    return [SType.List, result];
}


export function applyLimit(stack: IDBQueryStack): InstResult {
    
    let limit = stack.pop();
    let offset = stack.pop();

    return undefined;
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