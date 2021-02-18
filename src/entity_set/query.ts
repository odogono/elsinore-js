import Jsonpointer from 'jsonpointer';
import { EntityId, getEntityId, isEntity } from "../entity";
import {
    toComponentId,
    getComponentDefId,
    getComponentEntityId,
    getComponentId
} from "../component";
import { createLog } from "../util/log";
import { isRegex, isInteger, isString, isBoolean, isDate, isValidDate } from '@odgn/utils';
import {
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    and as bfAnd,
    or as bfOr,
    not as bfNot,
    typeFn as bfTypeFn,
    toValues as bfToValues,
    toString as bfToString,
    TYPE_AND,
    TYPE_OR,
    TYPE_NOT,
    isBitField
} from '@odgn/utils/bitfield';
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
import { ComponentDefId, getDefId, ComponentDef, getProperty, PropertyType } from "../component_def";
import { onLogicalFilter, parseFilterQuery } from './filter';
import { unpackStackValue, unpackStackValueR, stackToString } from "../query/util";
import { EntitySet, EntitySetMem } from ".";
import { compareDates } from '../query/words/util';
import { onBitFieldNot, onBitFieldOr, onPrintStack } from '../query/words';
import { onDiff } from '../query/words/list';

const Log = createLog('ESMemQuery');


class ESMemQueryStack extends QueryStack {
    es: EntitySetMem
}


export interface SelectOptions {
    stack?: QueryStack;
}
/**
 * 
 * @param es 
 * @param query 
 */
export async function select(stack: QueryStack, query: StackValue[], options: SelectOptions = {}): Promise<StackValue[]> {

    stack.setChild();

    // add first pass words
    stack.addWords([
        ['!bf', buildBitfield, SType.List],
        ['!bf', buildBitfield, SType.Value],
        ['!ca', onComponentAttr],
        ['define', onDefine],

        // converts a BitField to OR mode
        ['!or', onBitFieldOr, SType.BitField],
        ['not', onBitFieldNot, SType.BitField],

        ['order', onOrder, SType.ComponentAttr, SType.Value],
        ['limit', applyLimit],

        ['and', onLogicalFilter, SType.Any, SType.Any],
        ['or', onLogicalFilter, SType.Any, SType.Any],
        ['not', onLogicalFilter, SType.Any, SType.Any],
        ['==', onLogicalFilter, SType.Any, SType.Any],
        ['!=', onLogicalFilter, SType.Any, SType.Any],
        ['>', onLogicalFilter, SType.Any, SType.Any],
        ['>=', onLogicalFilter, SType.Any, SType.Any],
        ['<', onLogicalFilter, SType.Any, SType.Any],
        ['<=', onLogicalFilter, SType.Any, SType.Any],
        ['prints', onPrintStack],
    ]);


    // Log.debug('[select]', query );
    // Log.debug('[select]');
    // ilog(query);


    await stack.pushValues(query, { evalEscape: true });

    // reset stack items and words
    let items = stack.items;
    stack.clear();
    // stack.items = [];
    // stack.words = {};

    // Log.debug('[select] post');
    // ilog(items);



    stack.addWords([
        ['@e', fetchEntity],
        ['@eid', fetchEntity],
        ['@c', fetchComponents],
        ['@cid', fetchComponents],
        ['@ca', fetchComponentAttributes],
        ['!fil', applyFilter, SType.Filter],

        
        ['pluck', onPluck],
        ['pluck!', onPluck],
        ['diff', onDiff],
        ['diff!', onDiff],
        ['intersect', onDiff],
        ['intersect!', onDiff],
    ]);

    // make sure any filter values have a following cmd
    items = items.reduce((result, value, ii, items) => {
        result.push(value);
        if (value[0] === SType.Filter) {
            result.push('!fil');
        }
        return result;
    }, []);

    // Log.debug('[select]');
    // ilog(items);

    await stack.pushValues(items);

    let result = stack.items;
    // Log.debug('[select] pushing');
    // ilog(result);

    stack.restoreParent();

    return result;
}


function readEntityIds(stack: ESMemQueryStack): EntityId[] {
    const { es } = stack;

    let eids: EntityId[];

    let bf = stack.popBitFieldOpt();

    if (bf === undefined) {
        let from = stack.peek();

        if (from === undefined) {
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
            else if (from[0] === SType.Value && from[1] === false) {
                return [];
            }
            // Log.debug('[readEntityIds]', from);
        }
    }

    eids = matchEntities(es, undefined, bf);

    // Log.debug('[readEntityIds]', eids);

    // default to all of the entity ids
    return eids;
}


/**
 * 
 * @param stack 
 */
export function applyFilter(stack: ESMemQueryStack): InstResult {
    let filter;
    const { es } = stack;
    [, filter] = stack.pop();

    // determine whether the previous stack argument can give us
    // a set of eids. if not, then the filter is applied to all the entities
    // in the es
    let eids = readEntityIds(stack);

    // DLog(stack._root, 'bugger', filter);
    // ilog(stack.peek());
    let result = parseFilterQuery(es, filter[0], filter[1], filter[2]);
    // Log.debug('[applyFilter]', result);
    // Log.debug('[applyFilter]', Array.from(es.entities.keys()) );
    // Log.debug('[applyFilter]', 'query', result );

    eids = walkFilterQuery(es, eids, ...result).sort();
    // Log.debug('[applyFilter]', 'result eids', eids );
    // Log.debug('[applyFilter]', 'result' );
    // ilog( eids );

    return [SType.List, eids.map(eid => [SType.Entity, eid])];
}

function walkFilterQuery(es: EntitySetMem, eids: EntityId[], cmd?, ...args) {
    // console.log('[walkFQ]', eids, cmd, args);
    if (cmd === 'and') {
        let left = walkFilterQuery(es, eids, ...args[0]);
        // console.log('[walkFQ]', 'left', cmd, args[0], '->', left);
        if (left === undefined || left.length === 0) {
            return left;
        }

        // if there are no results, then return
        let right = walkFilterQuery(es, left, ...args[1]);
        // console.log('[walkFQ]', 'right', cmd, args[1], '->', right);
        return right;
    }
    else if (cmd === 'or') {
        let left = walkFilterQuery(es, eids, ...args[0]);
        // console.log('[walkFQ]', 'left', cmd, args[0], '->', left);
        let right = walkFilterQuery(es, eids, ...args[1]);
        // console.log('[walkFQ]', 'right', cmd, eids, args[0], '->', right);

        // Log.debug('[applyFilter]', 'or', left, right );

        // merge the results and return
        return [...new Set([...left, ...right])];
    }

    switch (cmd) {
        case '==':
        case '!=':
        case '>':
        case '>=':
        case '<':
        case '<=':
            return walkFilterQueryCompare(es, eids, cmd, ...args);
        case 'dids':
            return applyFilterDefIds(es, eids, args[0], args[1]);
        default:
            console.log('[walkFQ]', `unhandled cmd '${cmd}'`);
            return eids;

    }
}

function applyFilterDefIds(es: EntitySetMem, eids: EntityId[], dids, bf) {
    // console.log('[applyFilterDefIds]', eids, dids, bf );

    let feids = matchEntities(es, eids, bf);
    // console.log('[applyFilterDefIds]', feids );

    return feids;
}

function walkFilterQueryCompare(es: EntitySetMem, eids: EntityId[], cmd?, ...args) {
    let { def } = args[0];
    const did = getDefId(def);
    let [ptr, val] = args[1];
    const isJptr = ptr.startsWith('/');

    eids = matchEntities(es, eids, createBitField([did]));
    // console.log('[walkFilterQueryCompare]', 'eids', eids, did);
    let out = [];
    for (const eid of eids) {
        const cid = toComponentId(eid, did);
        const com = es.components.get(cid);

        if (com === undefined) {
            continue;
        }

        // console.log('[walk]', cmd, cid);
        // console.log('[walk]', cmd, ptr, val, cid);// {}.toString.call(val) );
        // if( com === undefined ){
        //     console.log('[walkFilterQueryCompare]', eid, def);
        // }

        let ptrVal = isJptr ? Jsonpointer.get(com, ptr) : com[ptr];


        // if( com[key] === val )
        // Log.debug('[walkFQ]','==', eid, ptr, ptrVal, val );
        // Log.debug('[walkFQ]','==', key, val, com[key], com);
        // if the value is an array, we look whether it exists
        if (Array.isArray(val)) {
            const r = val.indexOf(ptrVal) !== -1;
            if (cmd === '==') {
                out = r ? [...out, eid] : out;
            } else if (cmd === '!=') {
                out = r ? out : [...out, eid];
            }
            // out = val.indexOf(ptrVal) !== -1 ? [...out, eid] : out;
            // Log.debug('[walkFQ]', cmd, ptrVal, val, val.indexOf(ptrVal) );
        }
        if (ptrVal === undefined) {
        }
        else if (isDate(val)) {
            const ptrDte = new Date(ptrVal);
            if (isValidDate(ptrDte)) {
                if (compareDates(cmd, ptrDte, val)) {
                    // console.log('[walk]', cmd, ptrVal, val );
                    out = [...out, eid];
                }
            }
        }
        else if (isRegex(val)) {
            // console.log('[walkFQC]', ptrVal, val, val.test(ptrVal) );
            out = val.test(ptrVal) ? [...out, eid] : out;
        } else {

            // otherwise a straight compare
            out = ptrVal === val ? [...out, eid] : out;
        }
    }
    return out;
}


export function onOrder(stack: ESMemQueryStack): InstResult {
    let order = stack.popValue();
    let [bf, attrPtr] = stack.popValue();

    // Log.debug('[onOrder]', order, attrPtr);
    let did = bfToValues(bf)[0];

    stack.scratch.orderBy = [order.toLowerCase(), did, attrPtr];

    return undefined;
}

export function applyLimit(stack: ESMemQueryStack): InstResult {
    let offset = stack.popValue();
    let limit = stack.popValue();

    stack.scratch.limit = [ offset, limit ];

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




/**
 * first argument indicates which components should be fetched
 * 2nd argument is a list of entity ids
 * @param stack 
 */
export function fetchComponents(stack: ESMemQueryStack, [, op]: StackValue): InstResult {
    const { es } = stack;
    let left: StackValue;
    let eids: EntityId[];
    const returnCid = op === '@cid';

    let coms = [];

    // get the bitfield
    let bf = stack.popBitFieldOpt();

    // Log.debug('[fetchComponent]', 'bf', bf );

    left = stack.peek();

    // Log.debug('[fetchComponent]', 'peek', left);

    if (left !== undefined) {
        let from = stack.pop();
        // Log.debug('[fetchComponent]', 'arg', from);

        if (from[0] === SType.Entity) {
            eids = [unpackStackValueR(from)];
            // Log.debug('[fetchComponent]', 'fetching from entity', eids);

        } else if (from[0] === SType.List) {
            eids = from[1].map(it => {
                return isStackValue(it) ? getEntityId(it[1])
                    : isEntity(it) ? getEntityId(it) : undefined;
            }).
                filter(Boolean);
            // Log.debug('[fetchComponent]', eids);
        } else {
            // Log.debug('[fetchComponent]', 'unhandled', from);
            return [SType.List, []];
        }
    }

    // Log.debug('[fetchComponent]', eids, bfToValues(bf));
    // Log.debug('[fetchComponent]', eids, bfToValues(bf), bf?.type );

    // if an empty eid array has been passed, then no coms can be selected
    if (eids !== undefined && eids.length === 0) {
        return [SType.List, coms];
    }

    let [orderDir, orderDid, orderAttr, orderType] = stack.scratch.orderBy ?? ['desc'];
    let [offset, limit] = stack.scratch.limit ?? [0, Number.MAX_SAFE_INTEGER];
    if( orderType === undefined ){
        orderType = 'integer';
    }
    let isPtr = false;

    if (orderDid !== undefined ) {
        const def = es.getByDefId( orderDid );
        isPtr = orderAttr.startsWith('/');
        const prop = getProperty(def, isPtr ? orderAttr.substring(1) : orderAttr );
        if( prop === undefined ){
            console.log('[fetchComponent][orderBy]', 'could not find prop', orderAttr );
            orderDid = undefined;
        } else {
            orderType = prop.type;
        }
        // Log.debug('[fetchComponent]', 'orderBy', orderDid, orderAttr);
    }

    for (const [, com] of es.components) {
        const eid = getComponentEntityId(com);
        if (eids !== undefined && eids.length > 0) {
            if (eids.indexOf(eid) === -1) {
                continue;
            }
        }

        if (bf !== undefined && bf.isAllSet === false) {
            let cmpFn = bfTypeFn(bf);
            const ebf = es.entities.get(eid);
            if (cmpFn(bf, ebf) === false) {
                continue;
            }
            if (bfGet(bf, getComponentDefId(com)) === false) {
                continue;
            }
        }

        if (orderDid !== undefined) {
            let orderCom = es.components.get(toComponentId(eid, orderDid));
            if (orderCom !== undefined) {
                let val = isPtr ? Jsonpointer.get(orderCom, orderAttr) : orderCom[orderAttr];
                if (val !== undefined) {
                    val = isString(val) ? val.toLowerCase() : val;
                    if( orderType === 'datetime' ){
                        val = new Date(val).getTime();
                    }
                    coms.push([com, val, orderType]);
                    continue;
                }
            }
        }
        // Log.debug('[fetchComponent]', eid, com);

        coms.push([com, eid, 'entity']);
    }


    // sort
    coms.sort(([a, ac, at], [b, bc, bt]) => attrCompare(ac, bc, at, bt, orderDir));

    coms = coms.map( ([com]) => {
        return returnCid ? [SType.Value, getComponentId(com)]
            : [SType.Component,com];
    });

    coms = coms.slice(offset, limit);
    

    return [SType.List, coms]; //coms.map(c => [SType.Component, c])];
}

function attrCompare(a: any, b: any, aType:PropertyType, bType:PropertyType, orderDir:'asc'|'desc' = 'desc') {
    // console.log('[attrCompare]', a, b, aType, bType);
    let isDesc = orderDir === 'desc';
    if( aType === 'datetime' ){
        isDesc = !isDesc;
    }
    if( aType !== bType ){
        return 0;
    }
    if (a < b) {
        return isDesc ? -1 : 1;
    }
    if (a > b) {
        return isDesc ? 1 : -1;
    }
    return 0;
}

export function fetchComponentAttributes(stack: ESMemQueryStack): InstResult {
    const { es } = stack;
    let result = [];

    // get the attribute
    let attr = stack.pop();

    // determine whether the previous stack argument can give us
    // a set of eids. if not, then the filter is applied to all the entities
    // in the es
    let eids = readEntityIds(stack);

    // console.log('[fetchComponentAttributes]', attr );

    if (attr[0] === SType.Value) {
        attr = stringToComponentAttr(es, attr[1]);
    }
    else if (attr[0] !== SType.ComponentAttr) {
        throw new Error(`invalid component attr arg: ${attr[0]}`);
    }

    const [bf, ptr] = attr[1];

    const did = bfToValues(bf)[0];
    const def = es.getByDefId(did);
    const isJptr = ptr.startsWith('/');


    for (const eid of eids) {
        const cid = toComponentId(eid, did);
        const com = es.components.get(cid);

        if (com === undefined) {
            continue;
        }
        // console.log('[fetchComponentAttributes]', 'reading', cid, ptr );
        let val = isJptr ? Jsonpointer.get(com, ptr) : com[ptr];

        result.push([SType.Value, val]);
    }

    return [SType.List, result];
}


/**
 * Builds a ComponentAttr value - [Bitfield,string]
 * 
 * @param es 
 * @param stack 
 */
export function onComponentAttr(stack: QueryStack): InstResult {
    const { es } = stack;

    let right: string = stack.popValue(0, false);

    let result = stringToComponentAttr(es, right);

    if (result === undefined) {
        throw new Error(`invalid component attr: ${right}`);
    }

    // console.log('[onComponentAttr]', result );

    return result;
}


export function stringToComponentAttr(es: EntitySet, val: string): StackValue {
    const parts: RegExpExecArray = /^(\/.*)#(.*)/.exec(val);

    if (parts === null) {
        return undefined;
    }

    let [, did, pointer] = parts;
    const bf = es.resolveComponentDefIds([did]);
    if (bfCount(bf) === 0) {
        throw new StackError(`def not found: ${did}`);
    }

    // console.log('[stringToComponentAttr]', bfToValues(bf) );

    return [SType.ComponentAttr, [bf, pointer]];
}


export function buildBitfield(stack: QueryStack): InstResult {
    const { es } = stack;
    let arg: StackValue = stack.pop();

    let dids = unpackStackValueR(arg, SType.Any);
    if (dids === 'all') {
        return [SType.BitField, createBitField('all')];
    }
    dids = isString(dids) ? [dids] : dids;
    let bf: BitField = es.resolveComponentDefIds(dids);

    // Log.debug('[buildBitfield]', arg, bfToValues(bf) );
    return [SType.BitField, bf];
}

/**
 * Fetches an entity instance
 * 
 * @param es 
 * @param stack 
 */
export async function fetchEntity(stack: ESMemQueryStack, [, op]: StackValue): AsyncInstResult {
    const { es } = stack;
    let data: StackValue = stack.pop();
    const returnEid = op === '@eid';

    const type = data[0];
    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    let eids: number[];

    // Log.debug('[fetchEntity]', 'eh?', type, eid, data);

    if (type === SType.BitField) {
        bf = eid as BitField;
        eids = matchEntities(es, undefined, bf);

    } else if (isInteger(eid)) {
        // Log.debug('[fetchEntity]', 'eid only', eid, isInteger(eid), typeof eid );
        let e = es.getEntityMem(eid, returnEid ? false : true);

        if (e === undefined) {
            // Log.debug('[fetchEntity]', 'empty');
            return [SType.Value, false];
        }

        return returnEid ? [SType.Entity, eid] : [SType.Entity, e];
    }
    else if (Array.isArray(eid)) {
        // Log.debug('[fetchEntity]', 'eid array');
        eids = eid;
    }
    else if (type === SType.List) {
        let arr = unpackStackValue(data, SType.List, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
        // Log.debug('[fetchEntity]', 'unpack', eids);
    }
    else if (eid === 'all') {
        let ents = matchEntities(es, undefined, 'all');
        return [SType.List, ents];
    } else if (eid === undefined) {
        return [SType.Value, false];
    } else {
        throw new StackError(`@e unknown type ${type}`)
    }



    if (returnEid) {

        return [SType.List, eids.map(eid => [SType.Value, eid])];
    }

    // Log.debug('[fetchEntity]', 'ok', eids);

    let ents = es.getEntitiesByIdMem(eids, { populate: true });
    let result = ents.filter(Boolean).map(e => [SType.Entity, e]);

    // let result = [];
    // for( const eid of eids ){
    //     const e = await es.getEntity(eid, false);
    //     result.push( e === undefined ? [SType.Value,false] : [SType.Entity,e] );
    // }

    // Log.debug('[fetchEntity]', 'ok', result);

    return [SType.List, result];
}


/**
 * 
 * @param es 
 * @param eids 
 * @param mbf 
 */
export function matchEntities(es: EntitySetMem, eids: EntityId[], mbf: BitField | 'all'): EntityId[] {
    let matches: number[] = [];
    const isAll = mbf === 'all' || mbf === undefined || mbf.isAllSet;
    const type = isAll ? TYPE_AND : (mbf as BitField).type;
    let cmpFn = bfTypeFn(type); // bfAnd;
    if (type === TYPE_NOT) {
        cmpFn = bfNot;
    }
    if (isAll) {
        eids = eids !== undefined ? eids : Array.from(es.entities.keys());
        eids.sort();
        return eids;
    }

    if (bfCount(mbf as BitField) === 0) {
        return [];
    }

    if (eids === undefined) {
        // let es = from as EntitySetMem;
        for (let [eid, ebf] of es.entities) {
            if (cmpFn(mbf as BitField, ebf)) {
                // Log.debug('[matchEntities]', 'match', type, bfToValues(mbf as BitField), bfToValues(ebf) );
                // Log.debug('[matchEntities]', cmpFn);
                matches.push(eid);
            }
        }
    } else {
        for (let ii = 0; ii < eids.length; ii++) {
            let eid = eids[ii];
            let ebf = es.entities.get(eid);
            if (cmpFn(mbf as BitField, ebf)) {
                matches.push(eid);
            }
        }
    }

    // sort ascending
    matches.sort();

    return matches;
}


function ilog(...args) {
    if (process.env.JS_ENV === 'browser') { return; }
    const util = require('util');
    console.log(util.inspect(...args, { depth: null }));
}