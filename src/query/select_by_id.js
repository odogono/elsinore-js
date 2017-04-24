import { register, LEFT_PAREN, RIGHT_PAREN, VALUE } from './index';
// import Query from './index';
import EntitySet from '../entity_set';
import arrayUnique from '../util/array/unique';

const SELECT_BY_ID = 'SBI';

EntitySet.prototype.selectById = function(entityIds, returnAsEntitySet) {
    let result;
    returnAsEntitySet = returnAsEntitySet === undefined ? true : returnAsEntitySet;
    result = selectById(this.getRegistry(), this, entityIds, returnAsEntitySet);
    return result;
};

function dslSelectById(entityIds, selectFromRoot = false) {
    const context = this.readContext(this);

    context.pushVal(LEFT_PAREN);

    context.pushVal(entityIds, true);
    context.pushVal(selectFromRoot, true);

    context.pushVal(RIGHT_PAREN);

    context.pushOp(SELECT_BY_ID);

    return context;
}

function commandSelectById(context, entityIds, selectFromRoot) {
    let value;
    let entitySet;

    // console.log('>entityIds: ' + stringify(entityIds) );
    // console.log('>selectFromRoot: ' + stringify(selectFromRoot) );
    selectFromRoot = context.valueOf(selectFromRoot);
    // console.log('<<<');
    // printIns( context );
    // entitySet = selectFromRoot ? context.root : Q.resolveEntitySet( context, entitySet );
    entitySet = selectFromRoot ? context.root : context.resolveEntitySet(context.last);

    if (!entitySet) {
        entitySet = context.root;
    }

    // console.log('entityIds: ' + JSON.stringify(entityIds) );
    entityIds = context.valueOf(entityIds);

    // console.log('using es ' + stringify(selectFromRoot) + ' ' + entitySet.length );
    // console.log('entityIds: ' + JSON.stringify(entityIds) );
    // printIns( entitySet );
    //
    if (!entityIds) {
        entityIds = context.valueOf(context.last);
        // console.log('entityIds: ' + JSON.stringify(entityIds) );
    }

    if (!entityIds) {
        throw new Error('no entity ids supplied');
    }

    // printE( context.last );
    // console.log('selectFromRoot ' + selectFromRoot + ' ' + entitySet.cid + ' ' + context.last.cid );
    // process.exit();
    value = selectById(context.registry, entitySet, entityIds, true);

    return context.last = [ VALUE, value ];
}

function selectById(registry, entitySet, entityIds, returnAsEntitySet) {
    let ii, len, entity, result, entities = [];

    entityIds = Array.isArray(entityIds) ? entityIds : [ entityIds ];

    // remove duplicates
    entityIds = arrayUnique(entityIds);

    for (ii = 0, len = entityIds.length; ii < len; ii++) {
        if (entity = entitySet.getEntity(entityIds[ii])) {
            // console.log('select entity ' + entityIds[ii] );
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

register(SELECT_BY_ID, commandSelectById, { selectById: dslSelectById });
