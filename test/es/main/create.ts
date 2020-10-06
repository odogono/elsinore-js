import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    buildEntitySet,
    ChangeSetOp,
    createEntitySet,
    Component,
    Entity,
    EntitySet,
    EntitySetInst,
    getChanges,
    getComponentDefId,
    isEntity,
    Log,
    OrphanComponent,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';
import { printAll } from '../../../src/util/print';


let test = suite('es/mem - create');


test('should create an entity (id)', async () => {
    let es = createEntitySet();
    let eid = 0;

    eid = es.createEntityId();

    // assert.isAtLeast(eid, 1);
    assert.ok(eid >= 1);
});


test('passing an id generator', async () => {
    let id = 0;
    function idgen(){
        return ++id;
    }

    let es = new EntitySetInst(undefined, {idgen} );

    let a = es.createEntityId();
    let b = es.createEntityId();
    
    Log.debug( es );

    assert.equal( a, 1 );
    assert.equal( b, 2 );
    // let e = es.createEntity();


    // printAll(es, [e] );

});

test.run();