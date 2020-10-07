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
    sqlRetrieveEntities
} from "./sqlite";
import { Type, ComponentDefId, ComponentDef } from "../component_def";
import { onLogicalFilter, parseFilterQuery } from "../entity_set/filter";
import { onComponentAttr, buildBitfield, SelectOptions } from "../entity_set/query";
import { onDefine } from "../query/words/define";
import { onPluck } from "../query/words/pluck";

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

    // Log.debug('[select]', stack );
    // add 2nd pass words
    stack.addWords([
        ['@e', fetchEntity],
        ['@c', fetchComponents, SType.Entity, 'all'],
        ['@c', fetchComponents, SType.List, SType.BitField],
        ['@c', fetchComponents, SType.Entity, SType.BitField],
        ['@c', fetchComponents, 'all'],
        ['@c', fetchComponents, SType.BitField],
        ['@c', fetchComponents, SType.List],
        ['@c', fetchComponents, SType.Entity],
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

export function applyFilter(stack: SQLQueryStack): InstResult {
    let filter;
    const { es } = stack;
    [, filter] = stack.pop();

    // Log.debug('[applyFilter]', filter[2] );

    let result = parseFilterQuery(es, filter[0], filter[1], filter[2]);

    
    result = sqlRetrieveByQuery(es.db, result);
    
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




export function fetchComponents(stack: SQLQueryStack): InstResult {
    const { es } = stack;
    let left, right: StackValue;
    let eids: EntityId[];
    let defs: ComponentDefSQL[];


    // get the bitfield
    defs = stack.popBitField(true) as ComponentDefSQL[];

    left = stack.peek();

    if (left !== undefined) {
        let from = stack.pop();
        // Log.debug('[fetchComponents]', from );
        if (from[0] === SType.Entity) {
            eids = [unpackStackValueR(from)];
        } else if (from[0] === SType.List) {
            eids = from[1].map(it => {
                return isStackValue(it) ? getEntityId(it[1])
                    : isEntity(it) ? getEntityId(it) : undefined;
            }).filter(Boolean);
        }
    }

    let coms = [];
    // Log.debug('[fetchComponent]', 'good', eids, defs );

    coms = sqlRetrieveComponents(es.db, eids, defs || es.componentDefs);

    return [SType.List, coms.map(c => [SType.Component, c])];
}




/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: SQLQueryStack): AsyncInstResult {
    const { es } = stack;

    let data: StackValue = stack.pop();

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

    } else if (isInteger(eid)) {
        returnSingle = true;
        eids = [eid];

        // let e = await es.getEntity(eid, false);
        // if (e === undefined) {
        //     return [[SType.Value, false]];
        // }
        // return [[SType.Entity, eid]];
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
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }

    if( ents === undefined ){
        ents = await sqlRetrieveEntities(es.db, eids);
    }

    if( returnSingle ){
        let e = ents.length > 0 ? ents[0] : undefined;
        if (e === undefined) {
            return [SType.Value, false];
        }
        return [SType.Entity, eid];
    }

    let result = ents.map( e => [SType.Entity, e] );
    // Log.debug('[fetchEntity]', 'by bf', ents);
    return [SType.List, result];
}

function matchEntities(es: EntitySetSQL, mbf?: BitField): Entity[] {
    if (mbf === undefined) {
        return sqlRetrieveEntities(es.db);
    }
    return sqlRetrieveEntityByDefId(es.db, bfToValues(mbf));
}

function ilog(...args) {
    const util = require('util');
    console.log(util.inspect(...args, { depth: null }));
}