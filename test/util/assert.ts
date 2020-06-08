import { assert } from 'chai';
import {
    resolveComponentDefIds,
    getByDefId
} from '../../src/entity_set/registry';
import { Entity, getComponent, getComponents } from '../../src/entity';
import{ getComponentDefId } from '../../src/component';
import{ get as bfGet, toValues as bfToValues } from '../../src/util/bitfield';
import { EntitySet } from '../../src/entity_set/types';


export function assertIncludesComponents<ES extends EntitySet>(registry:ES, entity:Entity, dids:any[]) {
    const bf = resolveComponentDefIds( registry, dids );
    // const defs = resolveComponentDefIds( registry, dids ) as ComponentDef[];

    bfToValues(bf).forEach( (did,ii) => {
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

export function assertHasComponents<ES extends EntitySet>(registry:ES, entity:Entity, dids:any[]){
    const bf = resolveComponentDefIds( registry, dids );
    
    bfToValues(bf).forEach( (did,ii) => {
        // if( def === undefined ){
        //     assert.fail(`unknown component def ${dids[ii]}`);
        //     return;
        // }
        const com = getComponent(entity, did );
        
        if( com === undefined ){
            assert.fail(`missing component ${dids[ii]} on entity`);
        }
    })
    
    for( const com of getComponents(entity) ){
        const did = getComponentDefId(com);
        const def = getByDefId(registry, did);

        if( !bfGet(bf,did) ){
        // if( defs.find( def => getDefId(def) === did ) === undefined ){
            assert.fail(`entity has component ${def.uri}`);
        }
    }
}