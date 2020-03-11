import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    popValuesOfTypeV,
    pushV as pushQueryStack,
    replace as replaceQueryStack,
    findV,
    StackValue,
    findWithIndex, } from "../stack";
import { Type as EntitySetT, add as addEntity, EntitySet } from '../../entity_set';
import { VL, valueOf } from "./value";
import { Token as EntityT, 
    Entity,
    getEntityId, addComponent, create as createEntity } from '../../entity';
import { Token as ComponentT, getComponentEntityId } from '../../component';
import { isInteger } from "../../util/is";

const Log = createLog('Inst][Add');

export const ADD = Symbol.for('AD');

export const meta:InstDefMeta = {
    op: [ 'AD', '@e' ]
};

export function compile() {
}

export function execute( stack:QueryStack, op:string, ...args:any[] ):QueryStack {
    if( op === '@e' || args[0] === '@e' ){
        const eid =  isInteger(args[1]) ? args[1] : 0;
        return executeAddToEntity( stack, eid );
    }
    else if( args[0] === '@es' ){
        let es:EntitySet;
        let idx = -1;
        let value:StackValue; 
        // find the last es
        [idx, value] = findWithIndex( stack, EntitySetT );
        if( idx === -1  ){
            throw new Error('EntitySet not found on stack');
        }
        es = value[1];
        let ents:Entity[];
        [stack,ents] = popValuesOfTypeV( stack, EntityT );
        es = addEntity( es, ents );
        stack = replaceQueryStack( stack, idx, [EntitySetT, es] );
    }
    // Log.debug('[execute]', left, right );
    // const leftV = valueOf(left);
    // const rightV = valueOf(right);

    
    // stack = pushQueryStack( stack, leftV === rightV, VL );
    
    return stack;
}


function executeAddToEntity( stack:QueryStack, eid:number = 0 ): QueryStack {
    
    // collect all the components from the top of the stack
    // it stops popping when it comes to the first non ComponentT
    // value
    let [nstack, components] = popValuesOfTypeV( stack, ComponentT );

    // Log.debug('[executeAddToEntity]', 'components', components );

    const [_,entities] = components.reduce( ([entity,entities], com) => {
        let entityId = eid || getComponentEntityId( com );

        if( entity === null || entityId !== getEntityId(entity) ){
            // Log.debug('[executeAddToEntity]', 'new entity', getEntityId(entity), entity);
            entity = createEntity(entityId);
            entities.push( entity );
        }

        
        entity = addComponent(entity, com);
        entities.splice( entities.length-1, 1, entity );
        
        // Log.debug('[executeAddToEntity]', 'adding', entity );

        return [entity,entities];
    }, [null, []]);

    // push each entity to the stack
    return entities.reduce( (stack,entity) => {
        // Log.debug('[executeAddToEntity]', 'adding entity', entity )
        return pushQueryStack( stack, entity, EntityT );
    }, nstack );
    // Log.debug('[executeAddToEntity]', nstack);
    
    // return nstack;
}