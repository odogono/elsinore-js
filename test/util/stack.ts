
import { omit } from '../../src/util/omit';

// import * as InstCDef from '../../src/query/insts/component_def';
// import * as InstComC from '../../src/query/insts/component';
// import {COM,COMs} from '../../src/query/insts/component';
// import * as InstEnt from '../../src/query/insts/entity';
// import * as InstES from '../../src/query/insts/entity_set';
// import * as InstVal from '../../src/query/insts/value';
// import * as InstEq from '../../src/query/insts/equals';
// import * as InstAd from '../../src/query/insts/add';
// import * as InstAttr from '../../src/query/insts/attribute';
// import * as InstSelect from '../../src/query/insts/select';
// import * as InstStack from '../../src/query/insts/stack';
// import * as InstBf from '../../src/query/insts/bitfield';
// import * as InstCR from '../../src/query/insts/component_registry';
// import {VL} from '../../src/query/insts/value';
// import {
//     ComponentRegistry,
//     resolveComponentDefIds,
//     Type as ComponentRegistryT, getByDefId} from '../../src/component_registry';

import { create as createQueryStack, 
    peekV as peekQueryStack,
    
    findV,
    push,
    unshiftV,
    InstDef,
    pushValues,
    
    QueryStack, 
    InstModuleDef,
    StackOp,
    SType,
    StackValue} from '../../src/query/stack';
import {
    buildAndExecute as buildQuery,
    BuildQueryFn,
} from '../../src/query/build';
import { Entity, getComponent, getComponents, createBitfield, getEntityId, EntityList } from '../../src/entity';
import { EntitySet, Type as EntitySetT, 
    
    create as createEntitySet,
    getEntity,
    EntitySetMem} from '../../src/entity_set';
import { getDefId, toObject as defToObject, ComponentDef, Type } from '../../src/component_def';
import{ getComponentId, getComponentDefId, toObject as componentToObject } from '../../src/component';
import { loadFixture } from './import';
import { isString, isNumeric } from '../../src/util/is';
import { createLog } from '../../src/util/log';
import { tokenizeString } from '../../src/query/tokenizer';
import { stringify } from '../../src/util/json';

const Log = createLog('StackUtils');







export function stackToString( stack:QueryStack ):string {
    let parts = stack.items.map( val => valueToString(val) );
    return parts.join(' ');
}

export function valueToString( val:StackValue ):string {
    const [type,value] = val;
    switch( type ){
        case SType.Entity:
            return type;
        case SType.EntitySet:
            return type;
        case SType.ComponentDef:
            return `(${type} ${value.uri})`;
        case SType.Component:
            return `(${type} ${getComponentId(value)})`;
        case SType.Entity:
            return `(${type} ${getEntityId(value)})`;
        case SType.Array:
            return `[` + value.map(v => valueToString(v) ).join(' ') + ']';
        case SType.Map:
            return '{' + Object.keys(value).reduce( (res,key) => {
                return [...res, `${key}: ${valueToString(value[key])}`];
            },[]).join(',') + '}';
        default:
            return value;
    }
}

export const parse = (data) => tokenizeString( data, {returnValues:true} );
export const sv = (v):StackValue => [SType.Value,v];


/**
 * Exports the contents of an entityset as a series of instructions
 * @param es 
 */
export async function esToInsts( es:EntitySet ):Promise<string> {
    let result:string[] = [];
    const {esGetComponentDefs, esEntities, esGetEntity} = es;

    let defs = esGetComponentDefs(es);

    result = defs.reduce( (result,def) => {
        let obj = defToObject(def,false);
        // Log.debug('def', def);
        result.push( `${stringify(obj)} !d` );
        return result;
    },result);
    result.push('concat +');

    let eids = await esEntities(es);

    result = await eids.entityIds.reduce( async (result,eid) => {
        let buffer = await result;
        let e = await esGetEntity(es, eid);
        let inst = ``;
        let coms = Array.from(e.components.values());
        if( coms.length === 0 ){
            return buffer;
        }
        inst = inst + coms.map( com => {
            let {"@d":did, "@e":eid, ...obj} = componentToObject(com);
            let def = defs.find( d => getDefId(d) === did );
            obj = [def.uri, obj];
            return `${stringify(obj)} !c`
        }).join('\n');
        return [...buffer, inst + '\n' + 'concat +'];
    }, Promise.resolve(result) );

    // if( eids.entityIds.length > 0 ){
    //     result.push('concat +');
    // }

    // Log.debug('what', cl );
    // result = result.concat(cl);

    return result.join('\n');
}

export interface PrepareFixtureOptions {
    addToEntitySet?: boolean;
    allowOps?: string[];
}

export async function loadFixtureDefs( name:string ) {
    return prepareFixture(name, {allowOps:['!d']});
}

export async function prepareFixture( name:string, options:PrepareFixtureOptions = {} ): Promise<[ QueryStack, EntitySet ]> {
    let stack = buildQueryStack();
    let op:StackOp;
    let es:EntitySet;// = options.addToEntitySet ? createEntitySet({}) : undefined;

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

    return [ stack, es ];
}


export function buildQueryStack(){
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
    let stack = createQueryStack();
    // stack = addInstructionDef( stack, insts );
    return stack
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

export function buildAndExecuteQuery( stack:QueryStack, buildFn:BuildQueryFn ): [QueryStack,Entity] {
    let entity:Entity;

    // stack = buildQuery( stack, buildFn );

    // [stack, [,entity]] = push( stack, InstEnt.ENTs );

    return [stack,entity];
}

export function buildEntity( stack:QueryStack, buildFn:BuildQueryFn, entityId:number = 0 ): [QueryStack,Entity] {
    // find registry
    // let registry = findV( stack, ComponentRegistryT );
    // if( registry === undefined ){
    //     // registry = createComponentRegistry();
    //     stack = unshiftV( stack, registry, SType.EntitySet );
    // }
    let entity:Entity;

    // stack = buildQuery( stack, buildFn );

    // [stack, [,entity]] = pushValues( stack, [
    //     [InstEnt.ENTs,entityId]
    // ]);

    return [stack,entity];
}





export function serialiseStack(stack:QueryStack): any[] {
    let result = [];
    // let registry:ComponentRegistry;

    // for( let ii=0;ii<stack.items.length;ii++ ){
    //     const [type,item] = stack.items[ii];

    //     console.log('[serialiseStack]', ii, type );
    //     switch( type ){
    //         case ComponentRegistryT:
    //             registry = item;
    //             result = [...result, ...serialiseComponentRegistry(item) ];
    //             break;
    //         case EntitySetT:
    //             let esr = [ '@es', item.uuid ];
    //             result = [...result, esr, ...serialiseEntitySet(item, registry) ];
    //             break;
    //         default:
    //             console.log('[serialiseStack]', 'unknown', type );
    //             break;
    //     }
    // }

    return result;
}

// export function serialiseComponentRegistry( registry:ComponentRegistry ): any[] {
//     return registry.componentDefs.map( def => {
//         const obj = defToObject(def);

//         if( obj.properties.length > 0 ){
//             return [ '@d', obj.uri, obj.properties ];
//         }
//         return [ '@d', obj.uri ];
//     })
// }

export function serialiseEntitySet( es:EntitySetMem ): any[] {
    // const list = matchEntitySetEntities(es, createBitfield('all') ) as EntityList;
    // return list.entityIds.reduce( (res,eid) => {
    //     const e = getEntity(es, eid );
    //     const coms = getComponents(e);
    //     res = coms.reduce( (res,com) => {
    //         const def = getByDefId(es, getComponentDefId(com) );
    //         const attrs = omit( componentToObject(com), '@d', '@e');
    //         const out = [ '@c', def.uri ];
    //         res.push( Object.keys(attrs).length > 0 ? [...out,attrs] : out  );
    //         return res;
    //     }, res);
    //     res.push( ['@e', eid] );
    //     return res;
    // },[]);
    return [];
}

export function serialiseEntity( es:EntitySet, e:Entity ): any[] {
    // const eid = getEntityId(e);
    // const coms = getComponents(e);
    // let res = coms.reduce( (res,com) => {
    //     const def = getByDefId(es, getComponentDefId(com) );
    //     const attrs = omit( componentToObject(com), '@d', '@e');
    //     const out = [ '@c', def.uri ];
    //     res.push( Object.keys(attrs).length > 0 ? [...out,attrs] : out  );
    //     return res;
    // }, []);
    // // res.push(eid);
    // res.push( ['@e', eid] );
    return [];
}

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