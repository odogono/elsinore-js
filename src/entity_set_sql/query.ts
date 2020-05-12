import { EntityId, EntityList, createEntityList, createBitfield, isEntityList, Entity, getEntityId, isEntity } from "../entity";
import { ComponentId, ComponentList, toComponentId, isComponentList, createComponentList, fromComponentId, Component, isComponent } from "../component";
import { BitField } from "odgn-bitfield";
import { EntitySetSQL, getEntity, getComponent, ComponentDefSQL } from ".";
import { createLog } from "../util/log";
import { isObject, isInteger, isString, isBoolean } from "../util/is";
import { MatchOptions } from '../constants';

import { Type as EntityT } from '../entity';
import { getComponentId } from '../component';
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
    StackOp,
    isStackValue,
} from "../query/stack";
import { unpackStackValue, unpackStackValueR, onPluck } from "../query/words";
import { stackToString } from "../query/util";
import { resolveComponentDefIds, getByDefId } from "../entity_set/registry";
import { sqlRetrieveEntityIdByDefId, 
    sqlRetrieveByQuery, 
    sqlRetrieveEntityComponents, 
    sqlRetrieveComponents, 
    sqlRetrieveEntities } from "./sqlite";
import { Type, ComponentDefId, ComponentDef } from "../component_def";
import { onLogicalFilter, parseFilterQuery } from "../entity_set/filter";

const Log = createLog('SQLQuery');


interface SQLQueryStack extends QueryStack {
    es: EntitySetSQL
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(es: EntitySetSQL, query: StackValue[]): Promise<StackValue[]> {
    let stack = createStack() as SQLQueryStack;
    stack.es = es;

    // add first pass words
    stack = addWords<SQLQueryStack>(stack, [
        ['!bf', buildBitfield, SType.Array],
        ['!bf', buildBitfield, SType.Value],
        ['!ca', (stack: SQLQueryStack) => onComponentAttr(es, stack)],
        
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
        ['@c', fetchComponents, SType.Array, SType.Bitfield ],
        ['@c', fetchComponents, SType.Entity, SType.Bitfield ],
        ['@c', fetchComponents, 'all' ],
        ['@c', fetchComponents, SType.Bitfield ],
        ['@c', fetchComponents, SType.Array ],
        ['@c', fetchComponents, SType.Entity ],
        ['@v', fetchValue],
        // ['@cv', fetchComponentValues, SType.Entity ],
        // ['@cv', fetchComponentValues, SType.ComponentAttr ],
        // ['@cv', fetchComponentValues, SType.Entity ],
        ['!fil', applyFilter, SType.Filter],

        ['limit', applyLimit],
        ['pluck', onPluck, SType.Array, SType.Value],
        ['pluck', onPluck, SType.Array, SType.Array],
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
    // const util = require('util');
    // console.log( util.inspect( result, {depth:null} ) );

    result = sqlRetrieveByQuery( es.db, result );

    return [stack, result];
}

// function pr( es:EntitySetSQL, cmd?, left?, right? ){
//     // Log.debug('[pr]', cmd, left, ',', right);
//     switch(cmd){
//         case 'and':
//         case 'or':
//             return prAnd( es, cmd, left, right );
//         case SType.Bitfield:
//             return [ 'dids', (left as BitField).toValues() ];
//         case '==':
//             return prEquals( es, cmd, left, right );
//         case SType.ComponentAttr:
//             return prCA( es, left[0], left[1] );
//         case SType.Value:
//             return left;
//     }
    
// }

// function prCA( es:EntitySetSQL,dids, attr ){
//     const did = dids.toValues()[0];
//     const def = getByDefId(es, did );
//     // Log.debug('[prCA]', did, def)
//     return { def:def, key:attr };
// }

// function prEquals( es:EntitySetSQL, cmd, left, right ){
    
//     let key;
//     let val;
//     if( left[0] === SType.Value ){
//         val = left[1];
//         key = pr(es,...right);
//     } else if( right[0] === SType.Value ){
//         val = right[1];
//         key = pr(es, ...left);
//     } else {
//         return {eq:[ pr(es,...left), pr(es,...right)]};
//     }
//     if( 'key' in key ){
//         let {key:kk, ...rest} = key;
//         return [ cmd, rest, [kk,val] ];
//     }

//     // Log.debug('[prEquals]', [left,right]);
    
//     return { ...key, val };
// }
// function prAnd( es:EntitySetSQL, cmd, left, right ){
//     let l = pr( es, ...left );
//     let r = right !== undefined ? pr( es, ...right ) : undefined;
//     return [ cmd, l, r ];
// }


// export function onFilter(stack:SQLQueryStack, value:StackValue): InstResult<SQLQueryStack> {
//     let left, right;
//     const [,op] = value;

//     // Log.debug('[onFilter]', value);
    
//     [stack, right] = pop(stack);
//     [stack, left] = pop(stack);
//     if( left[0] === SType.Filter ){
//         left = left[1];
//     }
//     if( right[0] === SType.Filter ){
//         right = right[1];
//     }
//     // Log.debug('[onFilter]', op, 'L', left);
//     // Log.debug('[onFilter]', op, 'R', right);
    
//     stack = pushRaw(stack,[SType.Filter, [op, right, left]]);

//     return [stack ];
// }



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

    if (type === SType.Array) {
        value = unpackStackValue(arg);
        value = value.map(v => [SType.Value, v]);
        value = [SType.Array, value];
    }

    return [stack, value];
}



// export function esEquals(es: EntitySetSQL, stack: SQLQueryStack, op: string): InstResult<SQLQueryStack> {
//     let left, right;

//     [stack, right] = pop(stack);
//     [stack, left] = pop(stack);

//     let lType = left[0];
//     // let rType = right[0];
//     let lVal = unpackStackValue(left, SType.Any, false)
//     // let rVal = unpackStackValue(right, SType.Any)

//     // Log.debug('[esComponentValueEquals]', 'left', lType, lVal);
//     // Log.debug('[esComponentValueEquals]', 'right', right);



//     if (lType == SType.Array) {
//         lVal = lVal.reduce((out, val) => {
//             let cmp = compareStackValues(val, right);
//             if (op === '!=') {
//                 cmp = !cmp;
//             }
//             return cmp ? [...out, val] : out;
//         }, [])

//         return [stack, [SType.Array, lVal]];
//     } else if (lType === SType.ComponentAttr) {
//         const [bf, attr] = lVal;
//         let rVal = unpackStackValue(right);
//         let eids: EntityId[] = []; //matchEntities(es, bf);
//         let did = bf.toValues()[0];
//         const def = getByDefId(es,did);

//         // select 
//         let coms = sqlRetrieveComponentValue(es.db, def, attr, rVal, [], true);

//         // let coms = eids.map(eid => getComponent(es, toComponentId(eid, did)))
//         //     .filter(com => com[attr] === rVal)
//         //     .map(com => ([SType.Component, com]));

//         return [stack, [SType.Array, coms]];
//         // Log.debug('[esComValueEquals]', left );

//     } else {

//         throw new StackError(`esEquals: unhandled type ${lType}`);
//     }


//     return [stack];
// }

// function compareStackValues(left: StackValue, right: StackValue) {
//     if (left[0] === SType.ComponentValue) {
//         if (right[0] === SType.Value) {
//             let val = right[1];
//             return right[1] === unpackStackValue(left, SType.ComponentValue);
//         }
//         if (right[0] === SType.Entity) {
//             let eids = right[1];
//             eids = Array.isArray(eids) ? eids : [eids];
//             let [eid, did] = fromComponentId(left[1][0]);
//             return eids.indexOf(eid) !== -1;
//         }
//     }
//     throw new StackError(`compare : unhandled types ${left[0]} vs ${right[0]}`);
// }


function popBitField(stack:SQLQueryStack): [SQLQueryStack,ComponentDefSQL[]]{
    const {es} = stack;
    let val;
    let defs:ComponentDefSQL[];
    val = peek(stack);

    let [type, bf] = val;
    // Log.debug('[popBitField]', 'yes', stack.items);
    if( type === SType.Bitfield ){
        let dids = bf.toValues();
        defs = dids.map( d => getByDefId(es, d) );
    } else if( type === SType.Value && bf === 'all' ){
        // get all def ids
        defs = es.componentDefs;
    }
    if( defs !== undefined ){
        [stack] = pop(stack);
    }
    return [stack,defs];
}

export function fetchComponents(stack: SQLQueryStack): InstResult<SQLQueryStack> {
    const {es} = stack;
    let left, right: StackValue;
    let eids:EntityId[];
    let defs:ComponentDefSQL[];

    
    // get the bitfield
    [stack, defs] = popBitField(stack);
    
    // if( defs === undefined ){
    //     right = peek(stack);
        // Log.debug('[fetchComponent]', peek(stack) );
    // }

    // let [abf, attr] = unpackStackValue(right, SType.ComponentAttr);
    // let lVal = unpackStackValue(right, SType.Any, false);
    // let type = right[0];
    // Log.debug('[fetchComponent]', defs );

    left = peek(stack);
    
    if( left !== undefined ){
        let from;
        [stack,from] = pop(stack);
        // Log.debug('[fetchComponents]', from );
        if( from[0] === SType.Entity ){
            eids = [unpackStackValueR(from)];
        } else if( from[0] === SType.Array ){
            eids = from[1].map( it => {
                return isStackValue(it) && it[0] === SType.Entity ? it[1] 
                : isEntity(it) ? getEntityId(it) : undefined;
            }).filter(Boolean);
        }
    }
    
    let coms = [];
    // Log.debug('[fetchComponent]', 'good', eids, defs );
    
    coms = sqlRetrieveComponents(es.db, eids, defs || es.componentDefs);

    return [stack, [SType.Array, coms]];
    // return [stack, [SType.Component, coms]];
}



/**
 * Returns component values using the Component Attribute
 * 
 * @param es 
 * @param stack 
 */
// export async function fetchComponentValues(stack: SQLQueryStack): AsyncInstResult<SQLQueryStack> {
//     const {es} = stack;
//     let left, right: StackValue;
//     let eids:EntityId[];
//     [stack, right] = pop(stack);
    
//     let [abf, attr] = unpackStackValue(right, SType.ComponentAttr);
    
//     left = peek(stack);
    
//     if( left !== undefined ){
//         let from;
//         [stack,from] = pop(stack);
//         // Log.debug('[fetchComponentValues]', unpackStackValueR(from) );
//         if( from[0] === SType.Entity ){
//             eids = [ unpackStackValueR(from) ];
//         }
//     }
    
//     // Log.debug('[fetchComponentValues]', abf.toValues() );
    
//     // match eids on dids
//     // using cids, visit each referenced table and select attribute
//     // 2 queries - first to get eids, 2nd to get value from component
    
//     // let ents = sqlRetrieveEntityIdByDefId(es.db, abf.toValues() );
//     const did = abf.toValues()[0];
//     const def = getByDefId( es, did );
    
//     // Log.debug('[fetchComponentValues]', def, attr, eids );
//     let cValues = sqlRetrieveComponentValue( es.db, def, attr, undefined, eids );
    
//     // Log.debug('[fetchComponentValues]', cValues );
//     return [stack, [SType.Array, cValues]];
// }

function selectComAttribute(com: Component, attr) {
    let { "@e": e, "@d": d, [attr]: val, ...rest } = com;
    return [toComponentId(e, d), attr, val];
    // return {"@e":e, "@d":d, [attr]:val };
}

const cid = (v) => [SType.Component, v];
const cat = (v) => [SType.ComponentAttr, v];
const sv = (v) => [SType.Value, v];

/**
 * Builds a ComponentAttr value - [Bitfield,string]
 * 
 * @param es 
 * @param stack 
 */
export function onComponentAttr(es: EntitySetSQL, stack: SQLQueryStack): InstResult<SQLQueryStack> {
    let left, right: StackValue;
    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let attr = unpackStackValue(right, SType.Value);
    let did = unpackStackValue(left, SType.Value);

    let bf = resolveComponentDefIds(es, [did]);


    return [stack, [SType.ComponentAttr, [bf, attr]]];
}

export function buildBitfield(stack: SQLQueryStack): InstResult<SQLQueryStack> {
    let arg: StackValue;
    const {es} = stack;
    [stack, arg] = pop(stack);

    let dids = unpackStackValueR(arg, SType.Any);
    dids = isString(dids) ? [dids] : dids;
    let bf = resolveComponentDefIds(es, dids);
    
    return [stack, [SType.Bitfield, bf]];
}

/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export function fetchEntity(stack: SQLQueryStack): InstResult<SQLQueryStack> {
    const {es} = stack;
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

        return [stack, [SType.Array, ents]];

    } else if (isInteger(eid)) {
        let e = getEntity(es,eid,false);
        if (e === undefined) {
            return [stack, [SType.Value, false]];
        }
        return [stack, [SType.Entity, eid]];
    }
    else if( Array.isArray(eid) ){
        eids = eid;
    }
    else if (type === SType.Array) {
        let arr = unpackStackValue(data, SType.Array, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
    }
    else if( eid === 'all' ){
        let ents = sqlRetrieveEntities(es.db);
        return [stack, [SType.Array, ents]];
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    let result = eids.map(eid => getEntity(es,eid, false) )
    .map(eid => eid === undefined ? [SType.Value, false] : [SType.Entity,eid]);

    return [stack, [SType.Array, result]];
}

function entityIdFromValue( value:StackValue ):EntityId {
    const [type,val] = value;
    switch( type ){
        case SType.Entity:
        case SType.Component:
            return getEntityId(val);
        case SType.Value:
            return isInteger(val) ? val : undefined;
        default:
            return undefined;
    }
}

function matchEntities(es: EntitySetSQL, mbf: BitField): Entity[] {
    // let matches: number[] = [];
    
    return sqlRetrieveEntityIdByDefId(es.db, mbf.toValues());
    
    // Log.debug('[matchEntities]', mbf.toValues(), matches);
//     const isAll = BitField.isAllSet(mbf);// bf.toString() === 'all';
//     for (let [eid, ebf] of es.entities) {
//         if (isAll || BitField.and(mbf, ebf)) {
//             matches.push(eid);
//         }
//     }
    // return matches;
}

