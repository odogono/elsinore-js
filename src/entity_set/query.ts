import { EntityId, EntityList, createEntityList, createBitfield, isEntityList, Entity, getEntityId, isEntity } from "../entity";
import { ComponentId, ComponentList, toComponentId, isComponentList, createComponentList, fromComponentId, Component, isComponent, getComponentDefId, getComponentEntityId } from "../component";
import { BitField } from "odgn-bitfield";
import { EntitySet, EntitySetMem, getEntity, getComponent } from ".";
import { createLog } from "../util/log";
import { isObject, isInteger, isString, isBoolean } from "../util/is";
import { MatchOptions } from '../constants';
import {
    resolveComponentDefIds, getByDefId
} from "./registry";
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
    isStackValue,
} from "../query/stack";
import { unpackStackValue, unpackStackValueR, onPluck } from "../query/words";
import { stackToString } from "../query/util";
import { ComponentDef, ComponentDefId } from "../component_def";

const Log = createLog('ESMemQuery');


interface ESMemQueryStack extends QueryStack {
    es: EntitySetMem
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select(es: EntitySetMem, query: StackValue[]): Promise<StackValue[]> {
    let stack = createStack() as ESMemQueryStack;
    stack.es = es;

    // Log.debug('[select]', stackToString(stack) );

    stack = addWords<ESMemQueryStack>(stack, [
        ['@e', fetchEntity],
        ['@c', fetchComponents],
        ['@v', fetchValue],

        ['!bf', buildBitfield],
        ['!ca', onComponentAttr],
        ['==', esEquals, SType.Any, SType.Any],
        ['!=', esEquals, SType.Any, SType.Any],

        ['limit', applyLimit],
        ['pluck', onPluck],
    ]);

    [stack] = await pushValues(stack, query);
    // Log.debug('[select]', stackToString(stack) );


    return stack.items;
}


export function applyLimit(stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
    let limit, offset;
    [stack, limit] = pop(stack);
    [stack, offset] = pop(stack);

    return [stack];
}

export function fetchValue(stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
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

function popBitField<ST extends QueryStack>(stack:ST): [ST,ComponentDefId[]]{
    const {es} = stack;
    let val;
    let dids:ComponentDefId[];
    val = peek(stack);

    let [type, bf] = val;
    if( type === SType.Bitfield ){
        dids = bf.toValues();
    } else if( type === SType.Value && bf === 'all' ){
        dids = [];
    }
    if( dids !== undefined ){
        [stack] = pop(stack);
    }
    return [stack,dids];
}


export function fetchComponents(stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
    const {es} = stack;
    let left: StackValue;
    let eids:EntityId[];
    let dids:ComponentDefId[];
    let coms = [];

    // get the bitfield
    [stack, dids] = popBitField(stack);

    
    left = peek(stack);

    if( left !== undefined ){
        let from;
        [stack,from] = pop(stack);
        if( from[0] === SType.Entity ){
            eids = [unpackStackValueR(from)];
        } else if( from[0] === SType.Array ){
            eids = from[1].map( it => {
                return isStackValue(it) && it[0] === SType.Entity ? it[1] 
                : isEntity(it) ? getEntityId(it) : undefined;
            }).filter(Boolean);
        }
    }

    // Log.debug('[fetchComponent]', dids, eids );

    coms = Array.from( es.components.values() );
    if( dids.length > 0 ){
        coms = coms.filter(com => dids.indexOf( getComponentDefId(com) ) !== -1 );
    }

    if( eids !== undefined && eids.length > 0 ){
        coms = coms.filter(com => eids.indexOf( getComponentEntityId(com)) !== -1 );
    }

    coms = coms.map(c => [SType.Component, c]);
   
    return [stack, [SType.Array, coms]];
}


export function esEquals(stack: ESMemQueryStack, val:StackValue): InstResult<ESMemQueryStack> {
    const {es} = stack;
    let left, right;
    const [op] = val;

    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let lType = left[0];
    // let rType = right[0];
    let lVal = unpackStackValue(left, SType.Any, false)
    // let rVal = unpackStackValue(right, SType.Any)

    // Log.debug('[esComponentValueEquals]', 'left', lType, lVal);
    // Log.debug('[esComponentValueEquals]', 'right', right);

    if (lType == SType.Array) {
        // lVal = lVal.reduce((out, val) => {
        //     let cmp = compareStackValues(val, right);
        //     if (op === '!=') {
        //         cmp = !cmp;
        //     }
        //     return cmp ? [...out, val] : out;
        // }, [])

        return [stack, [SType.Array, false]];
    } else if (lType === SType.ComponentAttr) {
        const [bf, attr] = lVal;
        let rVal = unpackStackValue(right);
        let eids: EntityId[] = matchEntities(es, bf);
        let did = bf.toValues()[0];
        let coms = eids.map(eid => getComponent(es, toComponentId(eid, did)))
            .filter(com => com[attr] === rVal)
            .map(com => ([SType.Component, com]));

        return [stack, [SType.Array, coms]];
        // Log.debug('[esComValueEquals]', left );

    } else {

        throw new StackError(`esEquals: unhandled type ${lType}`);
    }


    return [stack];
}

function compareStackValues(left: StackValue, right: StackValue) {
    // if (left[0] === SType.ComponentValue) {
    //     if (right[0] === SType.Value) {
    //         let val = right[1];
    //         return right[1] === unpackStackValue(left, SType.ComponentValue);
    //     }
    //     if (right[0] === SType.Entity) {
    //         let eids = right[1];
    //         eids = Array.isArray(eids) ? eids : [eids];
    //         let [eid, did] = fromComponentId(left[1][0]);
    //         return eids.indexOf(eid) !== -1;
    //     }
    // }
    throw new StackError(`compare : unhandled types ${left[0]} vs ${right[0]}`);
}


/**
 * Returns component values using the Component Attribute
 * 
 * @param es 
 * @param stack 
 */
// export async function fetchComponentValues(stack: ESMemQueryStack): AsyncInstResult<ESMemQueryStack> {
//     const {es} = stack;
//     let left, right: StackValue;
//     [stack, right] = pop(stack);

//     let [abf, attr] = unpackStackValue(right, SType.ComponentAttr);

//     left = peek(stack);


//     let eids: number[];

//     if (left === undefined) {
//         // use the es as the context
//         let list = await es.esEntities(es, abf);
//         eids = list.entityIds;
//     } else {
//         let from;
//         [stack, from] = pop(stack);
//         if (from[0] === SType.Entity) {
//             eids = [ unpackStackValue(from) ];
//         }
//     }

//     if (eids === undefined) {
//         throw new StackError(`fetchComponentValues: invalid left value: ${left}`);
//     }

//     let dids = abf.toValues()

//     // Log.debug('[fetchComponentValues]', eids);

//     let attrs = eids.reduce((out, eid) => {
//         // get components
//         let coms: Component[] = dids.map(did => getComponent(es, toComponentId(eid, did)));

//         // compose ComponentValues from the components
//         return coms.reduce((out, com) =>
//             attr in com
//                 ? [...out, [SType.ComponentValue, selectComAttribute(com, attr)]]
//                 : out
//             , out);

//     }, [] as any[]);

//     // coms = coms.map(c => [SType.Component,c] );
//     // stack = { ...stack, items: [...stack.items, ...attrs] };
//     // return [stack];

//     return [stack, [SType.Array, attrs]];
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
export function onComponentAttr(stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
    const {es} = stack;
    let left, right: StackValue;
    [stack, right] = pop(stack);
    [stack, left] = pop(stack);

    let attr = unpackStackValue(right, SType.Value);
    let did = unpackStackValue(left, SType.Value);

    let bf = resolveComponentDefIds(es, [did]);


    return [stack, [SType.ComponentAttr, [bf, attr]]];
}

export function buildBitfield(stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
    const {es} = stack;
    let arg: StackValue;
    [stack, arg] = pop(stack);

    let dids = unpackStackValue(arg, SType.Any);

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
export function fetchEntity(stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
    const {es} = stack;
    let data: StackValue;
    [stack, data] = pop(stack);

    let eid = unpackStackValueR(data, SType.Any);
    let bf: BitField;
    let eids: number[];

    // Log.debug('[fetchEntity]', 'eh?', data, eid);

    if (data[0] === SType.Bitfield) {
        bf = eid as BitField;
        eids = matchEntities(es, bf);
    } else if (isInteger(eid)) {
        let e = getEntity(es,eid,false);
        // Log.debug('[fetchEntity]', es.entities);
        if (e === undefined) {
            return [stack, [SType.Value, false]];
        }
        return [stack, [SType.Entity, eid]];
    }
    else if (data[0] === SType.Array) {
        let arr = unpackStackValue(data, SType.Array, false);
        eids = arr.map(row => entityIdFromValue(row)).filter(Boolean);
    }
    else {
        throw new StackError(`@e unknown type ${data[0]}`)
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

function matchEntities(es: EntitySetMem, mbf: BitField): EntityId[] {
    let matches: number[] = [];
    const isAll = BitField.isAllSet(mbf);// bf.toString() === 'all';
    for (let [eid, ebf] of es.entities) {
        if (isAll || BitField.and(mbf, ebf)) {
            matches.push(eid);
        }
    }
    return matches;
}

export interface ESQuery {
    '@e'?: number | string | string[]; // entity id
    '@d'?: string; // def id
    '@a'?: string; // attribute
    limit?: number;
}

const CVal = 'CV';

type QVal = ['VL', any];

// Entity Id
type QEI = ['@e', EntityId];

type QEA = ['EC', EntityId, BitField];

// Component Id
type QCI = ['@c', ComponentId];

// Def Id
type QDI = ['@d', number];
type QDA = ['DA', number, string];

// Def Bitfield
type QDB = ['@bf', BitField];

// Component Attribute
type QCAT = ['CA', ComponentId, string];

// Component Attribute Value
type QCATV = ['CV', ComponentId, any];


// ['==', VL, VL ]
// ['&&', VL, VL ]
// ['||', VL, VL ]

export type QueryResult = EntityList | ComponentList;


/**
 * Takes queries in the form
 *  [BF, <bitField>] - selects matching components
 *  [AT, <bitField>, <attrName>] - selects attributes
 * <BF> <BF> OR - matches entities which match either
 * @param es 
 */
export function query(es: EntitySet, query: ESQuery): QueryResult {
    let result;

    if (Array.isArray(query) && query[0] === '==') {
        Log.debug('[query][==]', query);
    }


    if (query['@e']) {
        result = queryEntity(es, result, query['@e']);
    }

    if ('@d' in query) {
        result = queryComponentDef(es, result, query['@d']);
    }

    if (query['@a'] !== undefined) {
        result = queryAttribute(es, result, query['@a']);
    }

    return result;
}


export function compileQueryPart(es: EntitySet, query): any {
    if (isObject(query)) {
        let result = [];
        if ('@e' in query) {
            let eid = query['@e'];
            if (isInteger(eid)) {
                result = ['@e', eid];
            } else {
                let bf = resolveComponentDefIds(es, eid) as BitField;
                result = ['EC', bf.toValues()];
            }
        }
        if ('@d' in query) {
            let did = query['@d'];
            did = Array.isArray(did) ? did : [did];
            let bf = resolveComponentDefIds(es, did) as BitField;

            did = bf.toValues();// bf.count() === 1 ? bf.toValues()[0] : bf.toValues();
            if (result[0] === '@e') {
                result[0] = 'EC';
            } else {
                result[0] = '@d';
            }
            result.push(did);

            // look up 
            // return [CVal, cid, c?.attributes[attr]];
        }

        if ('@a' in query) {
            if (result[0] === '@d') {
                result[0] = 'CA';
            } else if (result[0] === 'EC') {
                result[0] = 'CA';
            } else if (result[0] === '@e') {
                result[0] = 'EA';
            }
            result.push(query['@a'])
        }
        return result;
    }
}

function queryEntity(es: EntitySet, result, eq) {
    if (isInteger(eq)) {
        if ((es as EntitySetMem).entities.get(eq as number)) {
            result = createEntityList([eq as number], createBitfield());
        }
    } else if (isString(eq) || Array.isArray(eq)) {
        let dids: any = eq;
        dids = Array.isArray(dids) ? dids : [dids];
        let bf = resolveComponentDefIds(es, dids) as BitField;
        // Log.debug('[query][resolve]', dids, bf.toValues() );
        result = matchEntitiesII(es as EntitySetMem, bf);
    }
    return result;
}
function queryComponentDef(es: EntitySet, result, cq) {
    cq = (Array.isArray(cq) ? cq : [cq]) as string[];
    let bf = resolveComponentDefIds(es, cq) as BitField;
    let cids = [];

    // Log.debug('[query]', 'cids', (es as EntitySetMem).components.keys() );
    if (isEntityList(result)) {
        (result as EntityList).entityIds.reduce((cids, eid) => {
            let ebf = (es as EntitySetMem).entities.get(eid);
            let dids = bf.toValues();
            for (let ii = 0; ii < dids.length; ii++) {
                if (ebf.get(dids[ii])) {
                    cids.push(toComponentId(eid, dids[ii]));
                }
            }
            return cids;
        }, cids)
    }
    else {
        (es as EntitySetMem).components.forEach((v, cid) => {
            let c = fromComponentId(cid)[1];
            if (bf.get(c)) {
                cids.push(cid);
            }
        })
    }

    return createComponentList(cids);
    // Log.debug('[query]', 'resolved', bf );
}

function queryAttribute(es: EntitySet, result, attr: string) {
    // Log.debug('[query]', 'select attribute', attr);
    // Log.debug('[query]', 'ok', result);
    if (isComponentList(result)) {
        result = (result as ComponentList).cids.map(cid => {
            let c = (es as EntitySetMem).components.get(cid);
            return [CVal, cid, c?.attributes[attr]];
        }) as any;
    }
    else if (isEntityList(result)) {
        let { entityIds, bf } = (result as EntityList);
        let dids = bf.toValues();
        result = entityIds.reduce((vals, eid) => {
            return dids.reduce((vals, did) => {
                let cid = toComponentId(eid, did);
                let c = (es as EntitySetMem).components.get(cid);
                let ca = c?.attributes[attr];
                if (ca !== undefined) {
                    return [...vals, [CVal, cid, ca]];
                }
                return vals;
            }, vals);

            // return vals;
        }, []) as any;
    }
    return result;
}

function matchEntitiesII(es: EntitySetMem, mbf: BitField): EntityList {
    let matches = [];
    // let entities = new Map<number,BitField>();
    // let {returnEntities, limit} = options;
    // limit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;

    const isAll = BitField.isAllSet(mbf);// mbf.toString() === 'all';
    for (let [eid, ebf] of es.entities) {
        if (isAll || BitField.and(mbf, ebf)) {
            matches.push(eid);
        }
    }
    return createEntityList(matches, mbf);
}

