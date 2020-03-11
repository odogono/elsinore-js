import { assert } from 'chai';
import { omit } from '../../src/util/omit';

import * as InstCDef from '../../src/query/insts/component_def';
import * as InstComC from '../../src/query/insts/component_create';
import * as InstVal from '../../src/query/insts/value';
import * as InstEq from '../../src/query/insts/equals';
import * as InstAd from '../../src/query/insts/add';
import * as InstSelect from '../../src/query/insts/select';
import {VL} from '../../src/query/insts/value';
import {
    ComponentRegistry,
    create as createComponentRegistry,
    resolveComponentDefIds,
    Type as ComponentRegistryT,
    getByDefId} from '../../src/component_registry';

import { create as createQueryStack, 
    execute as executeQueryStack,
    pushV as pushQueryStack,
    peekV as peekQueryStack,
    buildAndExecute as buildQuery,
    findV,
    unshiftV,
    addInstruction,
    InstDef,
    BuildQueryFn,
    BuildQueryParams,
    QueryStack } from '../../src/query/stack';
import { Entity, getComponent, getComponents, createBitfield } from '../../src/entity';
import { EntitySet, Type as EntitySetT, 
    matchEntities as matchEntitySetEntities, 
    getEntity} from '../../src/entity_set';
import { getDefId, toObject as defToObject } from '../../src/component_def';
import{ getComponentDefId, toObject as componentToObject } from '../../src/component';



export function buildQueryStack(){
    const insts:InstDef[] = [
        InstCDef,InstComC,InstVal,InstEq, InstAd,
        InstSelect
    ];
    let stack = createQueryStack();
    stack = addInstruction( stack, insts );
    // stack = addInstruction( stack, InstComC );
    // stack = addInstruction( stack, InstVal );
    return stack
}


export function buildComponentRegistry( buildFn?:BuildQueryFn ): [QueryStack, ComponentRegistry] {
    let registry = createComponentRegistry();
    let stack = buildQueryStack();

    stack = pushQueryStack( stack, registry );

    if( buildFn ){
        stack = buildQuery( stack, buildFn );
    }

    registry = findV( stack, ComponentRegistryT );

    return [stack, registry];
}

export function buildAndExecuteQuery( stack:QueryStack, buildFn:BuildQueryFn ): [QueryStack,Entity] {
    // // find registry
    // let registry = findV( stack, ComponentRegistryT );
    // if( registry === undefined ){
    //     registry = createComponentRegistry();
    //     stack = unshiftV( stack, registry, ComponentRegistryT );
    // }

    stack = buildQuery( stack, buildFn );

    stack = executeQueryStack( stack, [
        [ 'AD', '@e' ]
    ]);

    const entity:Entity = peekQueryStack( stack );

    return [stack,entity];
}

export function buildEntity( stack:QueryStack, buildFn:BuildQueryFn, entityId:number = 0 ): [QueryStack,Entity] {
    // // find registry
    // let registry = findV( stack, ComponentRegistryT );
    // if( registry === undefined ){
    //     registry = createComponentRegistry();
    //     stack = unshiftV( stack, registry, ComponentRegistryT );
    // }

    stack = buildQuery( stack, buildFn );

    stack = executeQueryStack( stack, [
        [ 'AD', '@e', entityId ]
    ]);

    const entity:Entity = peekQueryStack( stack );

    return [stack,entity];
}


export const assertHasComponents = (registry:ComponentRegistry, entity:Entity, dids:any[]) => {
    const defs = resolveComponentDefIds( registry, dids );

    
    
    
    
    defs.forEach( (def,ii) => {
        if( def === undefined ){
            assert.fail(`unknown component def ${dids[ii]}`);
            return;
        }
        const com = getComponent(entity, getDefId(def) );
        
        if( com === undefined ){
            assert.fail(`missing component ${dids[ii]} on entity`);
        }
    })
    
    const coms = getComponents( entity );
    coms.forEach( com => {
        const did = getComponentDefId(com);
        const def = getByDefId(registry, did);

        if( defs.find( def => getDefId(def) === did ) === undefined ){
            assert.fail(`entity has component ${def.uri}`);
        }
    })

    // // see https://github.com/chaijs/chai/blob/master/lib/chai/assertion.js
    // // for Assertion's argument definitions
    // const test = new chai.Assertion(null, null, chai.assert, true);

    // test.
    // test.assert(
    //     actual === "special",
    //     `expected ${actual} to be "special"`,
    //     `expected ${actual} to not be "special"`,
    //     "special",
    //     actual,
    //     true);
}


export function serialiseStack(stack:QueryStack): any[] {
    let result = [];
    let registry:ComponentRegistry;

    for( let ii=0;ii<stack.items.length;ii++ ){
        const [type,item] = stack.items[ii];

        console.log('[serialiseStack]', ii, type );
        switch( type ){
            case ComponentRegistryT:
                registry = item;
                result = [...result, ...serialiseComponentRegistry(item) ];
                break;
            case EntitySetT:
                let esr = [ '@es', item.uuid ];
                result = [...result, esr, ...serialiseEntitySet(item, registry) ];
                break;
            default:
                console.log('[serialiseStack]', 'unknown', type );
                break;
        }
    }

    return result;
}

export function serialiseComponentRegistry( registry:ComponentRegistry ): any[] {
    return registry.componentDefs.map( def => {
        const obj = defToObject(def);

        if( obj.properties.length > 0 ){
            return [ '@d', obj.uri, obj.properties ];
        }
        return [ '@d', obj.uri ];
    })
}

export function serialiseEntitySet( es:EntitySet, registry:ComponentRegistry ): any[] {
    return matchEntitySetEntities(es, createBitfield('all') ).entityIds.reduce( (res,eid) => {
        const e = getEntity(es, eid );
        const coms = getComponents(e);
        res = coms.reduce( (res,com) => {
            const def = getByDefId(registry, getComponentDefId(com) );
            const attrs = omit( componentToObject(com), '@d', '@e');
            const out = [ '@c', def.uri ];
            res.push( Object.keys(attrs).length > 0 ? [...out,attrs] : out  );
            return res;
        }, res);
        res.push( ['@e', eid] );
        return res;
    },[]);
}