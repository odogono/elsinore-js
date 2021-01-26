import Jsonpointer from 'jsonpointer';
import { EntityId, Entity, getEntityId, isEntity } from "../entity";
import { ComponentId, ComponentList, toComponentId, isComponentList, createComponentList, fromComponentId, Component, isComponent, getComponentDefId } from "../component";
import {
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    and as bfAnd,
    or as bfOr,
    toValues as bfToValues,
    isBitField
} from "../util/bitfield";
import { EntitySetSQL, ComponentDefSQL } from ".";
import { createLog } from "../util/log";
import { isInteger, isString, isBoolean } from "../util/is";

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
import { stackToString, unpackStackValue, unpackStackValueR } from "../query/util";
import {
    sqlRetrieveEntityByDefId,
    sqlRetrieveByQuery,
    sqlRetrieveEntityComponents,
    sqlRetrieveComponents,
    sqlRetrieveEntities,
    sqlRetrieveComponent,
    sqlRetrieveComponentIds
} from "./sqlite";
import { Type, ComponentDefId, ComponentDef } from "../component_def";
import { onLogicalFilter, parseFilterQuery } from "../entity_set/filter";
import { onComponentAttr, buildBitfield, SelectOptions, stringToComponentAttr } from "../entity_set/query";
import { onDefine } from "../query/words/define";
import { onPluck } from "../query/words/pluck";
import { onBitFieldOr } from "../query/words";
import { printEntity } from '../util/print';

const Log = createLog('SQLQuery');


class SQLQueryStack extends QueryStack {
    es: EntitySetSQL
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(stack:QueryStack, query: StackValue[], options:SelectOptions = {}): Promise<StackValue[]> {
    
    stack.setChild();
    
    // add first pass words
    stack.addWords([
        ['!bf', buildBitfield, SType.List],
        ['!bf', buildBitfield, SType.Value],
        ['!ca', onComponentAttr],
        ['define', onDefine],

        // converts a BitField to OR mode
        ['!or', onBitFieldOr, SType.BitField],

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

    // Log.debug('[select] post');
    // ilog(items);

    // add 2nd pass words
    stack.addWords([
        ['@e', fetchEntity],
        ['@eid', fetchEntity],
        ['@c', fetchComponents],
        ['@cid', fetchComponents],
        ['@ca', fetchComponentAttributes],

        // ['@e', fetchEntity],
        // ['@c', fetchComponents, SType.Entity, 'all'],
        // ['@c', fetchComponents, SType.List, SType.BitField],
        // ['@c', fetchComponents, SType.Entity, SType.BitField],
        // ['@c', fetchComponents, 'all'],
        // ['@c', fetchComponents, SType.BitField],
        // ['@c', fetchComponents, SType.List],
        // ['@c', fetchComponents, SType.Entity],
        ['@v', fetchValue],
        ['!fil', applyFilter, SType.Filter],

        ['limit', applyLimit],
        ['pluck', onPluck],
    ]);

    // make sure any filter values have a following cmd
    items = items.reduce((result, value, ii, items) => {
        if (value[0] === SType.Filter) {
            return [...result, value, '!fil'];
        }
        return [...result, value];
    }, []);

    // console.log('[select]', items );

    // Log.debug('pushing ', items);
    await stack.pushValues(items);

    let result = stack.items;

    stack.restoreParent();
    
    return result;
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


function readEntityIds( stack:SQLQueryStack ): EntityId[] {
    const { es } = stack;

    let eids:EntityId[];

    let bf = stack.popBitFieldOpt();

    if( bf === undefined ){
        let from = stack.peek();

        if( from === undefined ){
            // return matchEntities(es, undefined, undefined);
        }
        else {
            stack.pop();
            if (from[0] === SType.Entity) {
                return [unpackStackValueR(from)];
                // Log.debug('[fetchComponent]', 'fetching from entity', eids);
    
            } else if (from[0] === SType.List) {
                return from[1].map(it => {
                    return isStackValue(it) ? getEntityId(it[1])
                        : isEntity(it) ? getEntityId(it) : undefined;
                }).
                    filter(Boolean);
            }
            else if( from[0] === SType.Value && from[1] === false ){
                return [];
            }
            // Log.debug('[readEntityIds]', from);
        }
    }

    let ents = matchEntities(es, bf);
    eids = ents.map( e => e.id );

    // Log.debug('[readEntityIds]', eids);

    // default to all of the entity ids
    return eids;
}

export function applyFilter(stack: SQLQueryStack): InstResult {
    let filter;
    const { es } = stack;
    [, filter] = stack.pop();

    // Log.debug('[applyFilter]', filter[2] );
    // determine whether the previous stack argument can give us
    // a set of eids. if not, then the filter is applied to all the entities
    // in the es
    let eids = readEntityIds(stack);


    let result = parseFilterQuery(es, filter[0], filter[1], filter[2]);

    
    // Log.debug('[applyFilter]', 'query', result );

    result = sqlRetrieveByQuery(es.db, eids, result);
    
    // Log.debug('[applyFilter]', 'result' );
    // ilog( result );

    return result;
}



export function applyLimit(stack: SQLQueryStack): InstResult {
    let limit = stack.pop();
    let offset = stack.pop();

    return undefined;
}

export function fetchValue(stack: SQLQueryStack): InstResult {
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




export function fetchComponents(stack: SQLQueryStack, [,op]:StackValue): InstResult {
    const { es } = stack;
    let left, right: StackValue;
    let eids: EntityId[];
    const returnCid = op === '@cid';
    // let defs: ComponentDefSQL[];


    // get the bitfield
    // defs = stack.popBitField(true) as ComponentDefSQL[];
    let bf = stack.popBitFieldOpt();
    const defs = es.getComponentDefsFromBitField( bf ) as ComponentDefSQL[];

    // Log.debug('[fetchComponent]', 'bf', bf );

    left = stack.peek();

    if (left !== undefined) {
        let from = stack.pop();
        // Log.debug('[fetchComponent]', 'arg', from);
        // Log.debug('[fetchComponents]', from );
        if (from[0] === SType.Entity) {
            eids = [unpackStackValueR(from)];
        } else if (from[0] === SType.List) {
            eids = from[1].map(it => {
                return isStackValue(it) ? getEntityId(it[1])
                    : isEntity(it) ? getEntityId(it) : undefined;
            }).filter(Boolean);
        }
        else {
            return [SType.List, []];
        }
    }

    let coms = [];
    // Log.debug('[fetchComponent]', 'good', eids, defs );

    // let dids =  bf === undefined || bf.isAllSet ? undefined : bfToValues(bf);

    // let dids = bf !== undefined || bf.isAllSet ? undefined : bfToValues(bf);

    // coms = sqlRetrieveComponents(es.db, eids, dids );
    const allDefs = bf === undefined || (isBitField(bf) && bf.isAllSet) || defs === undefined;
    // Log.debug('[fetchComponent]', {allDefs, isAllSet:(isBitField(bf) && bf.isAllSet), undefined:(defs===undefined)}, bf);

    if( returnCid ){
        coms = sqlRetrieveComponentIds(es.db, eids, defs || es.componentDefs, allDefs);
        return [SType.List, coms.map(cid => [SType.Value, cid]) ];
    }

    coms = sqlRetrieveComponents(es.db, eids, defs || es.componentDefs, allDefs);
    return [SType.List, coms.map(c => [SType.Component, c])];
}



export function fetchComponentAttributes(stack:SQLQueryStack): InstResult {
    const { es } = stack;
    let result = [];

    // get the attribute
    let attr = stack.pop();

    // determine whether the previous stack argument can give us
    // a set of eids. if not, then the filter is applied to all the entities
    // in the es
    let eids = readEntityIds(stack);

    // console.log('[fetchComponentAttributes]', attr );

    if( attr[0] === SType.Value ){
        attr = stringToComponentAttr( es, attr[1] );
    }
    else if( attr[0] !== SType.ComponentAttr ){
        throw new Error(`invalid component attr arg: ${attr[0]}`);
    }

    const [bf,ptr] = attr[1];

    const did = bfToValues(bf)[0];
    const def = es.getByDefId( did );
    const isJptr = ptr.startsWith('/');


    for( const eid of eids ){
        const def = es.getByDefId(did);
        const com = sqlRetrieveComponent( es.db, eid, def);

        // Log.debug('[fetchComponentAttributes]', 'reading', eid, cid, com );
        if( com === undefined ){
            continue;
        }
        // console.log('[fetchComponentAttributes]', 'reading', cid, ptr );
        let val = isJptr ? Jsonpointer.get(com,ptr) : com[ptr];

        result.push( [SType.Value, val] );
    }
    
    return [SType.List, result];
}


/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: SQLQueryStack, [,op]:StackValue): AsyncInstResult {
    const { es } = stack;
    let data: StackValue = stack.pop();
    const returnEid = op === '@eid';

    const type = data[0];
    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    
    let eids: EntityId[];
    let ents: Entity[];
    let returnSingle = false;

    // Log.debug('[fetchEntity]', data, eid);

    if (type === SType.BitField) {
        
        bf = eid as BitField;
        ents = matchEntities(es, bf);

        // Log.debug('[fetchEntity]', ents);

    } else if (isInteger(eid)) {
        returnSingle = true;
        eids = [eid];

    }
    else if (Array.isArray(eid)) {
        eids = eid;
    }
    else if (type === SType.List) {
        let arr = unpackStackValue(data, SType.List, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
    }
    else if (eid === 'all') {
        ents = matchEntities(es);
        // return [[SType.List, ents]];
    } else if(eid === undefined){
        return [SType.Value, false];
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    if( ents === undefined ){
        ents = await sqlRetrieveEntities(es.db, eids);
    }

    if( returnSingle ){
        let e:Entity = ents.length > 0 ? ents[0] : undefined;
        if (e === undefined) {
            return [SType.Value, false];
        }

        if( returnEid ){
            return [SType.Entity, eid];
        }

        e = es.createEntity(e.id, e.bitField);
        e = es.retrieveEntityComponents(e);

        return [SType.Entity, e ];
        // return [SType.Entity, eid];
    }

    if( returnEid ){
        return [SType.List, ents.map(e => [SType.Value,e.id])];
    }

    let result = ents.map( e => {
        e = es.createEntity(e.id, e.bitField);
        e = es.retrieveEntityComponents(e);
        return [SType.Entity, e];
    })

    // let result = ents.map( e => [SType.Entity, e] );
    // Log.debug('[fetchEntity]', 'by bf', ents);
    
    return [SType.List, result];
}


// export function retrieveEntityComponents(es:EntitySetSQL, e:Entity){
//     let dids = bfToValues(e.bitField);
//     let defs = dids.map(did => es.getByDefId(did));

//     let coms = sqlRetrieveEntityComponents(es.db, e.id, defs);

//     // Log.debug('[getEntity]', coms );
//     for (const com of coms) {
//         const did = getComponentDefId(com);
//         // const def = this.getByDefId(did);
//         e = e.addComponentUnsafe(did, com);
//     }
//     return e;
// }

function matchEntities(es: EntitySetSQL, mbf?: BitField): Entity[] {
    if (mbf === undefined || mbf.isAllSet) {
        return sqlRetrieveEntities(es.db);
    }
    return sqlRetrieveEntityByDefId(es.db, bfToValues(mbf));
}

function ilog(...args) {
    const util = require('util');
    console.log(util.inspect(...args, { depth: null }));
}