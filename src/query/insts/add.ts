import { createLog } from "../../util/log";
import { QueryStack, InstDefMeta, 
    popValuesOfTypeV,
    pushV as pushQueryStack, } from "../stack";
import { VL, valueOf } from "./value";
import { Token as EntityT, getEntityId, addComponent, create as createEntity } from '../../entity';
import { Token as ComponentT, getComponentEntityId } from '../../component';

const Log = createLog('Inst][Add');

export const ADD = Symbol.for('AD');

export const meta:InstDefMeta = {
    op: 'AD'
};

export function compile() {
}

export function execute( stack:QueryStack, arg:string ):QueryStack {

    if( arg === '@e' ){
        return executeAddToEntity( stack );
    }
    // Log.debug('[execute]', left, right );
    // const leftV = valueOf(left);
    // const rightV = valueOf(right);

    
    // stack = pushQueryStack( stack, leftV === rightV, VL );
    
    return stack;
}


function executeAddToEntity( stack:QueryStack ): QueryStack {
    
    // collect all the components from the top of the stack
    // it stops popping when it comes to the first non ComponentT
    // value
    let [nstack, components] = popValuesOfTypeV( stack, ComponentT );

    // Log.debug('[executeAddToEntity]', 'components', components );

    const [_,entities] = components.reduce( ([entity,entities], com) => {
        const entityId = getComponentEntityId( com );
        if( entity === null || entityId !== getEntityId(entity) ){
            // Log.debug('[executeAddToEntity]', 'new entity', getEntityId(entity), entity);
            entity = createEntity(entityId);
            entities.push( entity );
        }

        entity = addComponent(entity, com);
        entities.splice( entities.length-1, 1, entity );

        // Log.debug('[executeAddToEntity]', 'added', entity );
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