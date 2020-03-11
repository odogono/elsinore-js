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
import { Token as ComponentT, getComponentEntityId, getComponentDefId } from '../../component';
import { isInteger } from "../../util/is";
import { BitField } from "odgn-bitfield";

const Log = createLog('Inst][Add');

export const ADD = Symbol.for('AD');

export const meta:InstDefMeta = {
    op: [ 'AD', '@e' ]
};

export function compile() {
}

export function execute( stack:QueryStack, op:string, ...args:any[] ):QueryStack {
    if( op === '@e' ){
        const eid =  isInteger(args[0]) ? args[0] : 0;
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
    return stack;
}


function executeAddToEntity( stack:QueryStack, eid:number = 0 ): QueryStack {
    
    // collect all the components from the top of the stack
    // it stops popping when it comes to the first non ComponentT
    // value
    let [nstack, components] = popValuesOfTypeV( stack, ComponentT );

    // Log.debug('[executeAddToEntity]', 'components', components );

    const [_,entities] = components.reduce( ([entity,entities], com) => {
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

    // push each entity to the stack
    return entities.reduce( (stack,entity) => {
        // Log.debug('[executeAddToEntity]', 'adding entity', entity )
        return pushQueryStack( stack, entity, EntityT );
    }, nstack );
    // Log.debug('[executeAddToEntity]', nstack);
    
    // return nstack;
}