import { EntityId, Entity, getEntityId, isEntity } from "../entity";
import { ComponentId, ComponentList, toComponentId, isComponentList, createComponentList, fromComponentId, Component, isComponent } from "../component";
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
import { EntitySetSQL, getEntity, getComponent, ComponentDefSQL } from ".";
import { createLog } from "../util/log";
import { isInteger, isString, isBoolean } from "../util/is";

import {
    create as createStack,
    addWords,
    pushValues,
    pop, peek,
    isStackValue,
    entityIdFromValue,
    popBitField,
} from "../query/stack";
import {
    SType,
    QueryStack,
    StackValue,
    InstResult, AsyncInstResult,
    StackError,
} from '../query/types';
import { stackToString, unpackStackValue, unpackStackValueR } from "../query/util";
import { resolveComponentDefIds, getByDefId } from "../entity_set/registry";
import { sqlRetrieveEntityByDefId, 
    sqlRetrieveByQuery, 
    sqlRetrieveEntityComponents, 
    sqlRetrieveComponents, 
    sqlRetrieveEntities } from "./sqlite";
import { Type, ComponentDefId, ComponentDef } from "../component_def";
import { onLogicalFilter, parseFilterQuery } from "../entity_set/filter";
import { onComponentAttr, buildBitfield } from "../entity_set/query";
import { onDefine } from "../query/words/define";
import { onPluck } from "../query/words/pluck";

const Log = createLog('SQLQuery');


interface SQLQueryStack extends QueryStack {
    es: EntitySetSQL
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(es: EntitySetSQL, query: StackValue[], options = {}): Promise<StackValue[]> {
    let stack = createStack() as SQLQueryStack;
    stack.es = es;
    if( 'stack' in options ){
        stack._root = stack._parent = options['stack'];
    }

    // add first pass words
    stack = addWords<SQLQueryStack>(stack, [
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
    stack = addWords<SQLQueryStack>(stack, [
        ['@e', fetchEntity],
        ['@c', fetchComponents, SType.Entity, 'all' ],
        ['@c', fetchComponents, SType.List, SType.Bitfield ],
        ['@c', fetchComponents, SType.Entity, SType.Bitfield ],
        ['@c', fetchComponents, 'all' ],
        ['@c', fetchComponents, SType.Bitfield ],
        ['@c', fetchComponents, SType.List ],
        ['@c', fetchComponents, SType.Entity ],
        ['@v', fetchValue],
        // ['@cv', fetchComponentValues, SType.Entity ],
        // ['@cv', fetchComponentValues, SType.ComponentAttr ],
        // ['@cv', fetchComponentValues, SType.Entity ],
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
/*
    and 
        (%bf, [8]) // this creates an eid list
        and // these 2 conditions need to be compressed into a single, because they both ref the same com
            == // FROM tbl_pos WHERE rank = 2
                2 
                (%ca, [[1],"rank"]) 
            == // FROM tbl_pos WHERE file = z
                "z" 
                (%ca, [[1],"file"])
*/

/*
[
  'and',
  { dids: [ 8 ] },
  [
    'and',
    [ '==', [ 'colour', 'black' ], { def: '/component/colour' } ],
    [ '==', [ 'file', 'z' ], { def: '/component/position' } ]
  ]
]

*/

export function applyFilter(stack:SQLQueryStack): InstResult<SQLQueryStack> {
    let filter;
    const {es} = stack;
    [stack, [,filter]] = pop(stack);

    // Log.debug('[applyFilter]', filter[2] );
    
    let result = parseFilterQuery( es, filter[0], filter[1], filter[2] );
    
    // Log.debug('[applyFilter]', 'result' );
    // ilog( result );

    result = sqlRetrieveByQuery( es.db, result );

    return [stack, result];
}



export function applyLimit(stack: SQLQueryStack): InstResult<SQLQueryStack> {
    let limit, offset;
    [stack, limit] = pop(stack);
    [stack, offset] = pop(stack);

    return [stack];
}

export function fetchValue(stack: SQLQueryStack): InstResult<SQLQueryStack> {
    let arg: StackValue;
    [stack, arg] = pop(stack);
    let type = arg[0];
    let value;

    if (type === SType.List) {
        value = unpackStackValue(arg);
        value = value.map(v => [SType.Value, v]);
        value = [SType.List, value];
    }

    return [stack, value];
}




export function fetchComponents(stack: SQLQueryStack): InstResult<SQLQueryStack> {
    const {es} = stack;
    let left, right: StackValue;
    let eids:EntityId[];
    let defs:ComponentDefSQL[];

    
    // get the bitfield
    [stack, defs] = popBitField(stack,true) as [SQLQueryStack, ComponentDefSQL[]];
    
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
    // Log.debug('[fetchComponent]', 'good', eids, defs );
    
    coms = sqlRetrieveComponents(es.db, eids, defs || es.componentDefs);

    return [stack, [SType.List, coms.map(c => [SType.Component,c] )]];
}




/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: SQLQueryStack): AsyncInstResult<SQLQueryStack> {
    const {es} = stack;
    const {esGetEntity} = es;

    let data: StackValue;
    [stack, data] = pop(stack);

    const type = data[0];
    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    let eids: number[];

    // Log.debug('[fetchEntity]', data, eid);

    if (type === SType.Bitfield) {
        bf = eid as BitField;
        let ents = matchEntities(es, bf);

        return [stack, [SType.List, ents]];

    } else if (isInteger(eid)) {
        let e = await esGetEntity(es,eid,false);
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
        let ents = matchEntities(es);
        return [stack, [SType.List, ents]];
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    let ents = await sqlRetrieveEntities( es.db, eids );
    let result = ents.map( e => [SType.Entity, getEntityId(e)] );

    // let result = [];
    // for( const eid of eids ){
    //     const e = await esGetEntity(es, eid, false);
    //     result.push( e === undefined ? [SType.Value,false] : [SType.Entity,e] );
    // }

    return [stack, [SType.List, result]];
}

function matchEntities(es: EntitySetSQL, mbf?: BitField): Entity[] {
    if( mbf === undefined ){
        return sqlRetrieveEntities(es.db);
    }
    return sqlRetrieveEntityByDefId(es.db, bfToValues(mbf));
}

function ilog(...args){
    const util = require('util');
    console.log( util.inspect( ...args, {depth:null} ) );
}