import { EntityId, EntityList, createEntityList, createBitfield, isEntityList, Entity } from "../entity";
import { ComponentId, ComponentList, toComponentId, isComponentList, createComponentList, fromComponentId } from "../component";
import { BitField } from "odgn-bitfield";
import { EntitySet, EntitySetMem, getEntity } from ".";
import { createLog } from "../util/log";
import { isObject, isInteger, isString } from "../util/is";
import { MatchOptions } from '../constants';
import {
    resolveComponentDefIds
} from "./registry";
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
 } from "../query/stack";
import { unpackStackValue } from "../query/words";
import { stackToString } from "../query/util";

const Log = createLog('ESMemQuery');


interface ESMemQueryStack extends QueryStack {
    es: EntitySetMem
}

/**
 * 
 * @param es 
 * @param query 
 */
export async function select( es:EntitySetMem, query:StackValue[] ): Promise<StackValue[]> {
    let stack = createStack() as ESMemQueryStack;
    stack.es = es;

    stack = addWords( stack, [
        ['!e', (stack:ESMemQueryStack) => onEntity(es,stack)],
    ]);
    
    [stack] = await pushValues(stack, query );
    // Log.debug('[select]', stackToString(stack) );


    return stack.items;
}


export function onEntity(es:EntitySetMem, stack: ESMemQueryStack): InstResult<ESMemQueryStack> {
    let data: StackValue;
    [stack, data] = pop(stack);

    let eid = unpackStackValue(data, SType.Value);
    let bf:BitField;
    
    if( isString(eid) ){
        bf = resolveComponentDefIds(es, [eid]);
        
        let matches:number[] = [];
        const isAll = BitField.isAllSet(bf);// bf.toString() === 'all';
        for (let [eid, ebf] of es.entities) {
            if (isAll || BitField.and(bf, ebf)) {
                matches.push(eid);
            }
        }
        // Log.debug('[onEntity]', 'did', eid);
        // let list = createEntityList(matches, bf);
        return [stack, [SType.Entity, matches]]
    }
    else if( isInteger(eid) ){
        let e = getEntity(es, eid );
        return [stack, [SType.Entity,e]];
    }

    return [stack];
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
            if( result[0] === '@d' ){
                result[0] = 'CA';
            } else if( result[0] === 'EC' ){
                result[0] = 'CA';
            } else if( result[0] === '@e' ){
                result[0] = 'EA';
            }
            result.push( query['@a'] )
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

/**
 * Returns a list of entity ids which match against the bitfield
 * 
 * TODO - GET RID
 * @param es 
 * @param mbf 
 * @param options 
 */
export function matchEntities(es: EntitySetMem, mbf: BitField, options: MatchOptions = {}): EntityList | Entity[] {
    let matches = [];
    // let entities = new Map<number,BitField>();
    let { returnEntities, limit } = options;
    limit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;

    const isAll = BitField.isAllSet(mbf);// mbf.toString() === 'all';
    for (let [eid, ebf] of es.entities) {
        // console.log('[matchEntities]', 'limit', eid, mbf.toString(), ebf.toString(), BitField.or( mbf, ebf ));
        if (isAll || BitField.or(mbf, ebf)) {
            if (returnEntities) {
                matches.push(getEntity(es, eid));
            } else {
                matches.push(eid);
                // entities.set(eid, ebf);
            }

            if (matches.length >= limit) {
                break;
            }
        }
    }

    // Log.debug('[matchEntities]', 'dammit', entities );
    return returnEntities ? matches : createEntityList(matches, mbf);
}