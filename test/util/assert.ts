import { assert } from 'chai';
import {
    ComponentRegistry,
    create as createComponentRegistry,
    resolveComponentDefIds,
    Type as ComponentRegistryT,
    getByDefId} from '../../src/component_registry';
import { Entity, getComponent, getComponents, createBitfield, getEntityId, EntityList } from '../../src/entity';
import { EntitySet, Type as EntitySetT, 
    matchEntities as matchEntitySetEntities, 
    create as createEntitySet,
    getEntity,
    EntitySetMem} from '../../src/entity_set';
import { getDefId, toObject as defToObject, ComponentDef } from '../../src/component_def';
import{ getComponentDefId, toObject as componentToObject } from '../../src/component';


export const assertIncludesComponents  = (registry:ComponentRegistry, entity:Entity, dids:any[]) => {
    const bf = resolveComponentDefIds( registry, dids );
    // const defs = resolveComponentDefIds( registry, dids ) as ComponentDef[];

    bf.toValues().forEach( (did,ii) => {
        // if( def === undefined ){
        //     assert.fail(`unknown component def ${dids[ii]}`);
        //     return;
        // }
        const com = getComponent(entity, did );
        
        if( com === undefined ){
            assert.fail(`missing component ${dids[ii]} on entity`);
        }
    })
}

export const assertHasComponents = (registry:ComponentRegistry, entity:Entity, dids:any[]) => {
    const bf = resolveComponentDefIds( registry, dids );
    
    bf.toValues().forEach( (did,ii) => {
        // if( def === undefined ){
        //     assert.fail(`unknown component def ${dids[ii]}`);
        //     return;
        // }
        const com = getComponent(entity, did );
        
        if( com === undefined ){
            assert.fail(`missing component ${dids[ii]} on entity`);
        }
    })
    
    const coms = getComponents( entity );
    coms.forEach( com => {
        const did = getComponentDefId(com);
        const def = getByDefId(registry, did);

        if( !bf.get(did) ){
        // if( defs.find( def => getDefId(def) === did ) === undefined ){
            assert.fail(`entity has component ${def.uri}`);
        }
    })
}