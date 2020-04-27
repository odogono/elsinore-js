import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    push as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta,
    StackValue,
    pop,
    InstResult,
    push,
    popOfTypeV,
    pushValues,
    AsyncInstResult
} from "../stack";
import { 
    createComponent, 
    Type as ComponentRegistryT 
} from "../../component_registry";
import { Type as ComponentT, Component, getComponentDefId, getComponentEntityId } from '../../component';
import { Type as EntityT, create as createEntity, getEntityId, addComponent, Entity, isEntity } from '../../entity';
import { isNumeric, isInteger } from "../../util/is";

const Log = createLog('Inst][Entity');

export const ENT = '@e';
export const ENTs = '!e';

export const meta:InstDefMeta = {
    op: [ ENT, ENTs ]
};


export async function execute(stack: QueryStack, [op,arg]:StackValue ):AsyncInstResult {
    
    if( op === ENT ){
        if( !isEntity(arg) ){
            return [stack, [op, createEntity(arg)]];
        }
    }

    if( isEntity(arg) ){
        return [stack, [op,arg]];
    }
    
    let value:StackValue;

    let uri:string;
    let attributes:object;
    let eid:number;
    let e:Entity;

    if( isInteger(arg) ){
        eid = arg;
    }

    // look for any components
    let coms:Component[];

    // consumes all previous Components on the stack
    [stack, coms] = popOfTypeV( stack, ComponentT );

    if( coms.length > 0 ){
        let ents:Entity[] = componentsToEntities( eid, coms );

        // push each of the entities onto the stack
        let insts:StackValue[] = ents.map( e => [EntityT,e] );
        [stack] = await pushValues(stack,insts);
        // [stack, value] = ents.reduce( ( [stack,value] ,e) => {
        //     return push( stack, [EntityT,e] );
        // }, [stack,value]);

        // return an undefined value so nothing further gets pushed on
        return [stack, value, false];

    } else {
        e = createEntity(eid);

        return [stack, [EntityT,e] ];
    }

    // [stack, value] = push(stack, [Entity,createEntity(id)]);

    // // pop uri
    // [stack, value] = pop(stack);
    // uri = value[1];

    // // pop properties
    // [stack, value] = pop(stack);
    // attributes = value[1];

    // // find the ComponentRegistry in the stack
    // let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

    // if (index === -1) {
    //     throw new Error('ComponentRegistry missing on stack');
    // }
    
    // const component = createComponent(registry, uri, attributes );
    
    // // Log.debug('[execute]', 'created', attributes, component );

    // value = [ ComponentT, component];
    // // stack = pushQueryStack( stack, [ ComponentT, component] );
    // // stack = replaceQueryStack(stack, index, [type, registry]);

    // // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
    // // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

    return [stack, value];
}

function componentsToEntities( eid:number, coms:Component[] ):Entity[] {
    // Log.debug('[componentsToEntities]', coms);
    const [_,ents] = coms.reduce( ([entity,entities], com) => {
        // const did = getComponentDefId(com);
        let entityId = eid || getComponentEntityId( com );

        if( entity === null || entityId !== getEntityId(entity) ){
            // Log.debug('[executeAddToEntity]', 'new entity', getEntityId(entity), entity);
            entity = createEntity(entityId);
            entities.push( entity );
        }

        // const debug = eid === 100 && did === 1;

        // if( debug ) Log.debug('[executeAddToEntity]', 'adding', eid, did, entity.bitField.toValues() );

        entity = addComponent(entity, com);

        // if( debug ) console.log( mbf.toValues() );
        // if( debug ) console.log( entity );
        // if( debug ) Log.debug('[executeAddToEntity]', 'added', eid, did, entity.bitField.toValues() );

        entities.splice( entities.length-1, 1, entity );
        
        // Log.debug('[executeAddToEntity]', 'added', eid, getComponentDefId(com), entity.bitField.toValues(), com );

        return [entity,entities];
    }, [null, []]);

    return ents;
}