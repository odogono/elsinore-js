import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    popOfTypeV,
    push,
    replace as replaceQueryStack,
    findV,
    StackValue,
    findWithIndex,
    peek,
    pop,
    InstResult,
    popOfType, } from "../stack";
import { Type as EntitySetT, 
    isEntitySet,
    add as addEntity, 
    create as createEntitySet,
    EntitySet } from '../../entity_set';
import { Type as EntityT, 
    Entity,
    getEntityId, addComponent, create as createEntity, isEntity } from '../../entity';
import { Type as ComponentT, getComponentEntityId, getComponentDefId, Component } from '../../component';
import { isInteger } from "../../util/is";
import { BitField } from "odgn-bitfield";

const Log = createLog('Inst][Add');

export const ADD = 'AD';

export const meta:InstDefMeta = {
    op: [ 'AD', '@el' ]
};


// export function execute( stack:QueryStack, [op,arg]:StackValue ):InstResult {
//     // if( op === '@e' ){
//     //     if( isEntity(args[0]) ){
//     //         // nothing to do with an entity VaLue
//     //         // Log.debug('[execute]', 'not adding', '@e', args );
//     //         return [stack, [op,args[0]] ];
//     //     }
//     //     return executeAddEntity( stack, args[0] );
//     // }
//     // else if( op === '@es' ){
//     //     if( isEntitySet(args[0]) ){
//     //         return [stack, [op,args[0]]];
//     //     }
//     //     return executeAddEntitySet(stack);
//     // }
//     // else if( op === '@el' ){
//     //     return [stack, [op,args[0]]];
//     // }

//     return [stack, undefined];
// }

// function executeAddEntity( stack:QueryStack, eid:number ): InstResult {
//     let value:StackValue;
//     let entity:Entity;

//     // if( isEntity(eid) ){
//     //     return [stack,undefined];
//     // }

//     // Log.debug('[addEntity]', eid );

//     if( eid === undefined ){
//         value = peek( stack );
    
//         if( value[0] === VL && isInteger(value[1]) ){
//             [stack, [,eid]] = pop(stack);
//         }
//     }

//     // look for any components
//     let coms:Component[];

//     [stack, coms] = popOfTypeV( stack, ComponentT );

//     if( coms.length > 0 ){
//         let ents:Entity[] = componentsToEntities( eid, coms );

//         // push each of the entities onto the stack
//         [stack, value] = ents.reduce( ( [stack,value] ,e) => {
//             return push( stack, [EntityT,e] );
//         }, [stack,value]);

//         // return an undefined value so nothing further gets pushed on
//         return [stack,value, false];

//     } else {
//         entity = createEntity(eid);

//         return [stack, [EntityT,entity] ];
//     }

//     // const eid =  isInteger(args[0]) ? args[0] : 0;
//     // return executeAddToEntity( stack, eid );

    
// }

// function executeAddEntitySet( stack:QueryStack ): InstResult {
//     // let value:StackValue;

//     let es:EntitySet;
//     let idx = -1;
//     let value:StackValue; 

//     value = peek(stack);

//     if( value[0] === EntityT ){
//         let ents;
//         [stack, ents] = popOfType(stack, EntityT);
//         es = createEntitySet();
//         es = addEntity( es, ents.map(e=>e[1]) );
//         return [stack, [EntitySetT, es]];
//     }

//     // // find the last es
//     [idx, value] = findWithIndex( stack, EntitySetT );
//     if( idx === -1  ){
//         throw new Error('EntitySet not found on stack');
//     }
//     es = value[1];
//     let ents:Entity[];
//     [stack,ents] = popOfTypeV( stack, EntityT );

//     // Log.debug('[executeAddEntitySet]', 'adding', ents );
//     es = addEntity( es, ents );
//     stack = replaceQueryStack( stack, idx, [EntitySetT, es] );

//     // Log.debug('[executeAddEntitySet]', stack.items );

//     return [stack, [EntitySetT,es], false];
// }

// function executeAddToEntity( stack:QueryStack, eid:number = 0 ): QueryStack {
    
//     // collect all the components from the top of the stack
//     // it stops popping when it comes to the first non ComponentT
//     // value
//     let [nstack, components] = popValuesOfTypeV( stack, ComponentT );

//     // Log.debug('[executeAddToEntity]', 'components', components );

//     const [_,entities] = components.reduce( ([entity,entities], com) => {
//         const did = getComponentDefId(com);
//         let entityId = eid || getComponentEntityId( com );

//         if( entity === null || entityId !== getEntityId(entity) ){
//             // Log.debug('[executeAddToEntity]', 'new entity', getEntityId(entity), entity);
//             entity = createEntity(entityId);
//             entities.push( entity );
//         }

//         // const debug = eid === 100 && did === 1;

//         // if( debug ) Log.debug('[executeAddToEntity]', 'adding', eid, did, entity.bitField.toValues() );

//         entity = addComponent(entity, com);

//         // if( debug ) console.log( mbf.toValues() );
//         // if( debug ) console.log( entity );
//         // if( debug ) Log.debug('[executeAddToEntity]', 'added', eid, did, entity.bitField.toValues() );

//         entities.splice( entities.length-1, 1, entity );
        
//         // Log.debug('[executeAddToEntity]', 'added', eid, getComponentDefId(com), entity.bitField.toValues(), com );

//         return [entity,entities];
//     }, [null, []]);

//     // push each entity to the stack
//     return entities.reduce( (stack,entity) => {
//         // Log.debug('[executeAddToEntity]', 'adding entity', entity )
//         return push( stack, entity, EntityT );
//     }, nstack );
//     // Log.debug('[executeAddToEntity]', nstack);
    
//     // return nstack;
// }


function componentsToEntities( eid:number, coms:Component[] ):Entity[] {
    const [_,ents] = coms.reduce( ([entity,entities], com) => {
        const did = getComponentDefId(com);
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