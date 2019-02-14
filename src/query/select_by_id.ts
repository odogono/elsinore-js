import { EntitySet } from '../entity_set';
import { QueryOp } from '../types';
import { arrayUnique } from '../util/array/unique';
import { register } from './dsl';

const SELECT_BY_ID = 'SBI';

// EntitySet.prototype.selectByID = function(entityIDs, returnAsEntitySet) {
//     let result;
//     returnAsEntitySet = returnAsEntitySet === undefined ? true : returnAsEntitySet;
//     result = selectByID(this.getRegistry(), this, entityIDs, returnAsEntitySet);
//     return result;
// };

function dslSelectByID(entityIDs, selectFromRoot = false) {
    const context = this.readContext(this);

    context.pushVal(QueryOp.LeftParen);

    context.pushVal(entityIDs, true);
    context.pushVal(selectFromRoot, true);

    context.pushVal(QueryOp.RightParen);

    context.pushOp(SELECT_BY_ID);

    return context;
}

function commandSelectByID(context, entityIDs, selectFromRoot) {
    let value;
    let entitySet;

    // console.log('>entityIDs: ' + stringify(entityIDs) );
    // console.log('>selectFromRoot: ' + stringify(selectFromRoot) );
    selectFromRoot = context.valueOf(selectFromRoot);
    // console.log('<<<');
    // printIns( context );
    // entitySet = selectFromRoot ? context.root : Q.resolveEntitySet( context, entitySet );
    entitySet = selectFromRoot ? context.root : context.resolveEntitySet(context.last);

    if (!entitySet) {
        entitySet = context.root;
    }

    // console.log('entityIDs: ' + JSON.stringify(entityIDs) );
    entityIDs = context.valueOf(entityIDs);

    // console.log('using es ' + stringify(selectFromRoot) + ' ' + entitySet.size() );
    // console.log('entityIDs: ' + JSON.stringify(entityIDs) );
    // printIns( entitySet );
    //
    if (!entityIDs) {
        entityIDs = context.valueOf(context.last);
        // console.log('entityIDs: ' + JSON.stringify(entityIDs) );
    }

    if (!entityIDs) {
        throw new Error('no entity ids supplied');
    }

    // printE( context.last );
    // console.log('selectFromRoot ' + selectFromRoot + ' ' + entitySet.cid + ' ' + context.last.cid );
    // process.exit();
    value = selectByID(context.registry, entitySet, entityIDs, true);

    return (context.last = [QueryOp.Value, value]);
}

function selectByID(registry, entitySet, entityIDs, returnAsEntitySet) {
    let ii,
        len,
        entity,
        result,
        entities = [];

    entityIDs = Array.isArray(entityIDs) ? entityIDs : [entityIDs];

    // remove duplicates
    entityIDs = arrayUnique(entityIDs);

    for (ii = 0, len = entityIDs.length; ii < len; ii++) {
        if ((entity = entitySet.getEntity(entityIDs[ii]))) {
            // console.log('select entity ' + entityIDs[ii] );
            entities.push(entity);
        }
    }

    if (returnAsEntitySet) {
        result = registry.createEntitySet({ register: false });
        result.addEntity(entities);
        return result;
    }

    return entities;
}

register(SELECT_BY_ID, commandSelectByID, { selectByID: dslSelectByID });
