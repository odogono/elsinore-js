import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    buildComponents,
    buildEntitySet,
    ChangeSetOp,
    createEntitySet,
    Component,
    Entity,
    EntitySet,
    EntitySetInst,
    getChanges,
    getComponentDefId,
    hashDef,
    isComponentDef,
    isEntity,
    Log,
    OrphanComponent,
    printAll,
    beforeEach,
    prepES,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';
import { sqlRetrieveComponentsByDef } from '../../../src/entity_set_sql/sqlite';

let test = suite('es/sqlite - iterators');




test.before.each( beforeEach );



test('iterates over entity ids', async () => {
    let [, es] = await prepES(undefined, 'todo');

    for await( const eid of es.getEntities() ){
        // console.log('eid', eid);
    }
    const def = es.getByUri('/component/title');

    // for await( const com of sqlRetrieveComponentsByDef(es.db, def) ){
    for await ( const com of es.getComponents() ){
        console.log('com', com );
    }

    // let it = es.getEntities();

    // console.log( await it.next() );
});


test.run();