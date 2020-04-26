import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    findWithIndexV,
    peek as peekQueryStack,
    push,
    replace as replaceQueryStack,
    InstDefMeta,
    InstResult,
    popOfTypeV,
    StackValue,
    pop,
    compile,
    peek,
    findV,
    StackValueCompiled
} from "../stack";
import {
    Type as ComponentRegistryCode,
    Type as ComponentRegistryT, getComponentDefs, resolveComponentDefIds, ComponentRegistry 
} from "../../component_registry";
import { Type as ComponentDefT } from '../../component_def';
import * as StackInsts from './stack';

import { VL, valueOf } from "./value";
import { BitField } from "odgn-bitfield";
import { Type as EntityT, EntityListType, EntityList, Entity, getEntityId, createEntityList } from "../../entity";
import { Type as EntitySetT, getEntity, matchEntities as esMatchEntities } from '../../entity_set';
import { isInteger, isString } from "../../util/is";
import { Attribute, compile as compileAttr } from './attribute';


const Log = createLog('Inst][Select');

export const EQ = 'AL';

export enum Select {
    AllEntities = 'SEA',
    AllComponents = 'SCA',
    SomeEntities = 'SEO',
    SomeComponents = 'SCO',
    NoneEntities = 'SEN',
    NoneComponents = 'SCN',
    Entity = 'SE',
    Component = 'SC'
};

export const meta:InstDefMeta = {
    op: Object.values(Select)
};

const fns = {
    [Select.Entity]: selectEntity,
    [Select.AllEntities]: selectEntitiesWithAll,
    [Select.AllComponents]: selectComponentsWithAll,
    [Select.SomeEntities]: selectEntitiesWithSome,
    [Select.SomeComponents]: selectComponentsWithSome
};


/**
 * Select can only work on entities and components that have ids - orphaned entities
 * on the stack cannot be selected
 * 
 * Forms:
 * AL <defId> <args>
 * AL <defId>
 * AL <@d>
 */
export function execute( stack:QueryStack, [op,arg]:StackValue ):InstResult {
    let value:StackValue;
    const fn = fns[ op ];
    
    if( fn === undefined ){
        throw new Error(`op not found: ${op}`);
    }
    
    // Log.debug('[execute]', stack.items );

    [stack,value] = pop(stack);

    Log.debug('[execute]', 'did', value);

    // popOfTypeV( stack, VL );

    // did = Array.isArray(did) ? did : [did];

    return fn( stack, value );
    
    // return [stack];

    // if( args[0] === ComponentRegistryCode ){
    //     return executeSelectDefs( stack );       
    // }

    // // const leftV = valueOf(left);
    // // const rightV = valueOf(right);

    // // stack = pushQueryStack( stack, leftV === rightV, VL );

    // return stack;
}


function selectEntity( stack:QueryStack, value:StackValue ): InstResult {
    let [type,container] = peek(stack);
    let e:Entity;
    let bf:BitField;
    let [,eid] = value;

    if( isInteger(eid) ){
        if( type === EntitySetT ){
            e = getEntity( container, eid );
        }
        else if( type === EntityT ){
            e = getEntityId(container) === eid ? container : undefined;
        }
    } else if( isString(eid) ){
        let registry = findV(stack, ComponentRegistryT);
        // can only be a did
        bf = resolveComponentDefIds( registry, [eid] ) as BitField;
        // Log.debug('resolve', eid, bf.toValues(), type )

        if( type === EntitySetT ){
            let el = esMatchEntities( container, bf, {limit:1, returnEntities:true} ) as Entity[];
            e = el[0];
        }
        else if( type === EntityT ){
            if( BitField.or( bf, (container as Entity).bitField ) ){
                e = container;
            }
        }
    }

    return [stack, [EntityT,e] ];
}

/**
 * 
 * @param stack 
 * @param args component defIds
 */
function selectEntitiesWithAll( stack:QueryStack, criteria:StackValue ): InstResult {
    let value:StackValue;

    let [criteriaType, criteriaValue] = criteria;
    // Log.debug('[selectEntitiesWithAll]', criteria );

    // let [ ridx, registry ] = findWithIndexV( stack, ComponentRegistryT );
    
    // // convert into a bitfield of def ids
    // const bf = resolveComponentDefIds( registry, dids ) as BitField;
    let bf;// = BitField.create('all');
    
    let registry = findV( stack, ComponentRegistryT );
    // const [bf,attrName] = resolveComponentDefAttribute( registry, args );


    if( criteriaType === StackInsts.StackList ){

        let es = findV( stack, EntitySetT );

        let el = compileList( stack, criteriaValue );
        Log.debug('stack compiled', el );

        bf = determineBitField(registry, el);

        let ents = esMatchEntities( es, bf );

        // take each entity
        // push each StackList inst onto the stack
        // if it is an attribute inst:, -- substitute in [ component, attr, GET ]
        // - get the component
        // - get the component attr


        Log.debug('stack list bf', bf.toValues() );
        Log.debug('pre stack', stack.items );
        // let el = criteriaValue as EntityList;
        // const isES = ec[0] === EntitySetT;

        // let ents = el.entityIds.map( eid => getEntity( ec[1], eid ) );

        // ents.reduce( (stack,e) => {
        //     [stack] = push(stack, [EntityT, e]);
        //     [stack] = push(stack, criteria );

        //     Log.debug('ok', stack.items );

        //     return stack;
        // }, stack);

        // Log.debug('ok', stack.items );

        
        // el = entityListReduce( el, (e) => {

        // }, []);
    } else if( criteriaType === VL && isString(criteriaValue) ){
        let [el] = [createEntityList() ];// matchEntities( stack, bf );
        let registry = findV( stack, ComponentRegistryT );
        bf = resolveComponentDefIds( registry, [criteriaValue] ) as BitField;

        // Log.debug('[selectEntitiesWithAll]', bf.toValues(), criteriaValue );
        let es = findV(stack, EntitySetT);

        el = esMatchEntities( es, bf ) as EntityList;
        
        return [stack, [EntityListType,el]];
    }
    
    // // add to stack
    // [stack,value] = push( stack, [EntityListType,el] );
    
}

function compileList( stack:QueryStack, list:any[] ): StackValueCompiled[] {
    return list.map( inst =>  compile( stack, inst ) );
}

/**
 * Scans the values for components or attributes
 * @param list 
 */
function determineBitField( registry:ComponentRegistry, list:StackValueCompiled[] ):BitField {
    return list.reduce( (bf,[[op,val],]) => {
        Log.debug('check', op, val );
        if( op === 'AT' ){
            return bf.set( val[0] as BitField );
        }
        return bf;
    }, BitField.create() );
}

// function selectEntitiesWithAll( stack:QueryStack, dids:any[] ): InstResult {
//     let value:StackValue;

//     let [ ridx, registry ] = findWithIndexV( stack, ComponentRegistryT );
    
//     // convert into a bitfield of def ids
//     const bf = resolveComponentDefIds( registry, dids ) as BitField;
    
//     let [ents] = matchEntities( stack, bf );
    
//     // Log.debug('[selectEntitiesWithAll]', dids, bf, ents );

//     // add to stack
//     [stack,value] = push( stack, [EntityListType,ents] );
    
//     return [stack, value, false];
// }

function selectEntitiesWithSome( stack:QueryStack, ...args:any[] ): InstResult {
    return [stack];
}

function selectComponentsWithAll( stack:QueryStack, ...args:any[] ): InstResult {
    return [stack];
}

function selectComponentsWithSome( stack:QueryStack, ...args:any[] ): InstResult {
    return [stack];
}





function executeSelectDefs( stack:QueryStack ):InstResult {

    // find the component registry
    let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    const defs = getComponentDefs(registry);

    return [defs.reverse().reduce( (st, def) => {
        [stack] = push( st, [ComponentDefT,def] );
        return stack;
    }, stack )];
}