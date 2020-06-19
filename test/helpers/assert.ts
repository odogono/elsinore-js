import { assert } from 'chai';

import { Entity } from '../../src/entity';
import{ getComponentDefId } from '../../src/component';
import{ get as bfGet, toValues as bfToValues } from '../../src/util/bitfield';
import { EntitySet } from '../../src/entity_set';


export function assertIncludesComponents<ES extends EntitySet>(es:ES, e:Entity, dids:any[]) {
    const bf = es.resolveComponentDefIds(dids );
    // const defs = resolveComponentDefIds( registry, dids ) as ComponentDef[];

    bfToValues(bf).forEach( (did,ii) => {
        // if( def === undefined ){
        //     assert.fail(`unknown component def ${dids[ii]}`);
        //     return;
        // }
        const com = e.getComponent(did );
        
        if( com === undefined ){
            assert.fail(`missing component ${dids[ii]} on entity`);
        }
    })
}

export function assertHasComponents<ES extends EntitySet>(es:ES, e:Entity, dids:any[]){
    const bf = es.resolveComponentDefIds(dids );
    
    bfToValues(bf).forEach( (did,ii) => {
        // if( def === undefined ){
        //     assert.fail(`unknown component def ${dids[ii]}`);
        //     return;
        // }
        const com = e.getComponent(did );
        
        if( com === undefined ){
            assert.fail(`missing component ${dids[ii]} on entity`);
        }
    })
    
    for( const com of e.getComponents() ){
        const did = getComponentDefId(com);
        const def = es.getByDefId(did);

        if( !bfGet(bf,did) ){
        // if( defs.find( def => getDefId(def) === did ) === undefined ){
            assert.fail(`entity has component ${def.uri}`);
        }
    }
}