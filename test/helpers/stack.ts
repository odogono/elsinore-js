
import {
    SType,
    StackValue,
} from '../../src/query/types';
import {
    BuildQueryFn,
} from '../../src/query/build';
import { Entity } from '../../src/entity';
import { getDefId, toObject as defToObject } from '../../src/component_def';
import { toObject as componentToObject } from '../../src/component';
import { createLog } from '../../src/util/log';
import { tokenizeString } from '../../src/query/tokenizer';
import { stringify } from '../../src/util/json';
import {
    onSwap, onConcat, onListOpen, onMapOpen, onEntity, 
    onComponentDef, onComponent, 
    onAddArray, onAddComponentToEntity,
    onAddToEntitySet
} from '../../src/query/words';
import { unpackStackValue } from '../../src/query/util';
import { EntitySet } from '../../src/entity_set';
import { QueryStack } from '../../src/query/stack';

const Log = createLog('StackUtils');







export const parse = (data) => tokenizeString(data, { returnValues: true });
export const sv = (v): StackValue => [SType.Value, v];


/**
 * Exports the contents of an entityset as a series of instructions
 * @param es 
 */
export async function esToInsts(es: EntitySet): Promise<string> {
    let result: string[] = [];
    // const { esGetComponentDefs, esEntities, esGetEntity } = es;

    // let defs = esGetComponentDefs(es);

    // result = defs.reduce((result, def) => {
    //     let obj = defToObject(def, false);
    //     // Log.debug('def', def);
    //     result.push(`${stringify(obj)} !d`);
    //     return result;
    // }, result);
    // result.push('concat +');

    // let eids = await esEntities(es);

    // result = await eids.entityIds.reduce(async (result, eid) => {
    //     let buffer = await result;
    //     let e = await esGetEntity(es, eid);
    //     let inst = ``;
    //     let coms = Array.from(e.components.values());
    //     if (coms.length === 0) {
    //         return buffer;
    //     }
    //     inst = inst + coms.map(com => {
    //         let { "@d": did, "@e": eid, ...obj } = componentToObject(com);
    //         let def = defs.find(d => getDefId(d) === did);
    //         obj = [def.uri, obj];
    //         return `${stringify(obj)} !c`
    //     }).join('\n');
    //     return [...buffer, inst + '\n' + 'concat +'];
    // }, Promise.resolve(result));

    // // if( eids.entityIds.length > 0 ){
    // //     result.push('concat +');
    // // }

    // // Log.debug('what', cl );
    // // result = result.concat(cl);

    return result.join('\n');
}

export interface PrepareFixtureOptions {
    addToEntitySet?: boolean;
    allowOps?: string[];
}

export async function loadFixtureDefs(name: string) {
    return prepareFixture(name, { allowOps: ['!d'] });
}

export async function prepareFixture(name: string, options: PrepareFixtureOptions = {}): Promise<[QueryStack, EntitySet]> {
    let stack = buildQueryStack();
    let op: SType;
    let es: EntitySet;// = options.addToEntitySet ? createEntitySet({}) : undefined;

    // // add the registry to the stack
    // [stack] = push( stack, [ComponentRegistryT, es] );

    // let data = await loadFixture( 'todo.ldjson' );

    // // Log.debug('data', data);

    // stack = data.reduce( (stack, inst) => {
    //     let [op, ...args] = inst;

    //     if( op === '!format' ){
    //         return stack;
    //     }

    //     if( options.allowOps?.indexOf(op) === -1 ){
    //         return stack;
    //     }

    //     // Log.debug('[prepFix]', op, options.allowOps);

    //     if( op === InstCDef.DEFs ){
    //         let [uri, properties] = args;
    //         // Log.debug('ugh', args);
    //         [stack]  = pushValues( stack,[ {uri,properties}, op ] );
    //     } else if( op === COMs ){
    //         let [uri, attributes] = args;
    //         [stack]  = push( stack, [COMs,{[COM]:uri,attributes}] );
    //     } else {
    //         [stack] = push( stack, [op, args[0]] );
    //     }
    //     return stack;
    // }, stack);

    // if( options.addToEntitySet ){
    //     [stack, [op,es]] = push( stack, '!es' );
    // }

    // registry = findV( stack, ComponentRegistryT );

    return [stack, es];
}


export function buildQueryStack() {
    // const insts:InstModuleDef[] = [
    //     InstStack, InstCDef,
    //     InstComC,
    //     InstEnt,
    //     InstES,
    //     InstVal, 
    //     InstEq, 
    //     InstAd,
    //     InstSelect, 
    //     InstAttr, 
    //     InstBf,
    //     InstCR
    // ];
    // let stack = createQueryStack();
    // stack = addInstructionDef( stack, insts );
    return undefined;
}


// export function buildComponentRegistry( buildFn?:BuildQueryFn ): [QueryStack, ComponentRegistry] {
//     let stack = buildQueryStack();

//     [stack] = push( stack, [ComponentRegistryT,registry] );

//     if( buildFn ){
//         stack = buildQuery( stack, buildFn );
//     }

//     registry = findV( stack, ComponentRegistryT );

//     return [stack, registry];
// }

// export function buildAndExecuteQuery(stack: QueryStack, buildFn: BuildQueryFn): [QueryStack, Entity] {
//     let entity: Entity;

//     // stack = buildQuery( stack, buildFn );

//     // [stack, [,entity]] = push( stack, InstEnt.ENTs );

//     return [stack, entity];
// }

// export async function buildEntity(es: EntitySet, query: string, entityId: number = 0): Promise<Entity> {

//     let stack = createQueryStack();
//     stack = addWords(stack, [
//         ['swap', onSwap],
//         ['concat', onConcat],
//         ['[', onListOpen],
//         ['{', onMapOpen],
//         ['!e', onEntity],
//         // ['@e', onEntityFetch, SType.Value],
//         ['!d', onComponentDef, SType.List],
//         ['!c', onComponent, SType.List],
//         ['!es', onEntitySet, SType.Map],
//         ['+', onAddArray, SType.List, SType.Any],
//         ['+', onAddComponentToEntity, SType.Entity, SType.Any],
//         ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
//     ]);


//     [stack] = await push(stack, [SType.EntitySet, es]);

//     let insts = parse(`${query} concat ${entityId} !e swap +`);
//     [stack] = await pushValues(stack, insts);

//     let ev;
//     [stack, ev] = pop(stack);

//     let e = unpackStackValue(ev, SType.Entity);

//     return e;
// }





// export function serialiseStack(stack: QueryStack): any[] {
//     let result = [];
//     // let registry:ComponentRegistry;

//     // for( let ii=0;ii<stack.items.length;ii++ ){
//     //     const [type,item] = stack.items[ii];

//     //     console.log('[serialiseStack]', ii, type );
//     //     switch( type ){
//     //         case ComponentRegistryT:
//     //             registry = item;
//     //             result = [...result, ...serialiseComponentRegistry(item) ];
//     //             break;
//     //         case EntitySetT:
//     //             let esr = [ '@es', item.uuid ];
//     //             result = [...result, esr, ...serialiseEntitySet(item, registry) ];
//     //             break;
//     //         default:
//     //             console.log('[serialiseStack]', 'unknown', type );
//     //             break;
//     //     }
//     // }

//     return result;
// }

// export function serialiseComponentRegistry( registry:ComponentRegistry ): any[] {
//     return registry.componentDefs.map( def => {
//         const obj = defToObject(def);

//         if( obj.properties.length > 0 ){
//             return [ '@d', obj.uri, obj.properties ];
//         }
//         return [ '@d', obj.uri ];
//     })
// }

// export function serialiseEntitySet(es: EntitySetMem): any[] {
//     // const list = matchEntitySetEntities(es, createBitfield('all') ) as EntityList;
//     // return list.entityIds.reduce( (res,eid) => {
//     //     const e = getEntity(es, eid );
//     //     const coms = getComponents(e);
//     //     res = coms.reduce( (res,com) => {
//     //         const def = getByDefId(es, getComponentDefId(com) );
//     //         const attrs = omit( componentToObject(com), '@d', '@e');
//     //         const out = [ '@c', def.uri ];
//     //         res.push( Object.keys(attrs).length > 0 ? [...out,attrs] : out  );
//     //         return res;
//     //     }, res);
//     //     res.push( ['@e', eid] );
//     //     return res;
//     // },[]);
//     return [];
// }

// export function serialiseEntity(es: EntitySet, e: Entity): any[] {
//     // const eid = getEntityId(e);
//     // const coms = getComponents(e);
//     // let res = coms.reduce( (res,com) => {
//     //     const def = getByDefId(es, getComponentDefId(com) );
//     //     const attrs = omit( componentToObject(com), '@d', '@e');
//     //     const out = [ '@c', def.uri ];
//     //     res.push( Object.keys(attrs).length > 0 ? [...out,attrs] : out  );
//     //     return res;
//     // }, []);
//     // // res.push(eid);
//     // res.push( ['@e', eid] );
//     return [];
// }

// function parseData( stack:QueryStack, data:string[] ): any[]{

//     return data.map( inst => {
//         if( isString(inst) ){
//             if( getInstruction(stack, inst) !== undefined ){
//                 return [ inst ];
//             }
//         }
//         else if( Array.isArray(inst) ){
//             if( inst.length > 0 ){
//                 if( getInstruction(stack, inst) !== undefined ){
//                     return inst;
//                 }
//             }
//         }

//         return [ VL, inst ];
//     })
// }