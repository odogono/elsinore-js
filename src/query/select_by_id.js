import _ from 'underscore';
import {register,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE} from './index';
import Query from './index';
import EntitySet from '../entity_set';
import * as Utils from '../util'

const SELECT_BY_ID = 'SBI';


_.extend( EntitySet.prototype, {
    selectById: function( entityIds, returnAsEntitySet ){
        let result;
        returnAsEntitySet = (returnAsEntitySet === undefined) ? true : returnAsEntitySet;
        result = selectById( this.getRegistry(), this, entityIds, returnAsEntitySet );
        return result;
    }
});


function dslSelectById( entityIds, selectFromRoot=false ){
    const context = this.readContext(this);

    context.pushVal( LEFT_PAREN );
    
    context.pushVal( entityIds, true );
    context.pushVal( selectFromRoot, true );

    context.pushVal( RIGHT_PAREN );

    context.pushOp( SELECT_BY_ID );

    return context;
}


function commandSelectById( context, entityIds, selectFromRoot ) {
    let ii, len, value, entity, entities;
    let entitySet;

    // console.log('>entityIds: ' + Utils.stringify(entityIds) );
    // console.log('>selectFromRoot: ' + Utils.stringify(selectFromRoot) );
    selectFromRoot = context.valueOf(selectFromRoot);
    // console.log('<<<');
    // printIns( context );
    // entitySet = selectFromRoot ? context.root : Q.resolveEntitySet( context, entitySet );
    entitySet = selectFromRoot ? context.root : context.resolveEntitySet(context.last );

    if( !entitySet ){
        entitySet = context.root;
    }

    // console.log('entityIds: ' + JSON.stringify(entityIds) );
    entityIds = context.valueOf(entityIds );

    // console.log('using es ' + Utils.stringify(selectFromRoot) + ' ' + entitySet.length );
    // console.log('entityIds: ' + JSON.stringify(entityIds) );
    // printIns( entitySet );

    // 
    if( !entityIds ){
        entityIds = context.valueOf(context.last );
        // console.log('entityIds: ' + JSON.stringify(entityIds) );
    }

    if( !entityIds ){
        throw new Error('no entity ids supplied');
    }

    // printE( context.last );
    // console.log('selectFromRoot ' + selectFromRoot + ' ' + entitySet.cid + ' ' + context.last.cid );
    // process.exit();

    value = selectById( context.registry, entitySet, entityIds, true );

    return (context.last = [ VALUE, value ]);
}

function selectById( registry, entitySet, entityIds, returnAsEntitySet ){
    let ii,len,entity,result, entities = [];

    entityIds = _.isArray(entityIds) ? entityIds : [entityIds];

    // remove duplicates
    entityIds = _.uniq( entityIds );

    for( ii=0,len=entityIds.length;ii<len;ii++ ){
        if( (entity = entitySet.getEntity(entityIds[ii])) ){ 
            // console.log('select entity ' + entityIds[ii] );
            entities.push( entity ); 
        }
    }

    if( returnAsEntitySet ){
        result = registry.createEntitySet( {register:false} );
        result.addEntity( entities );
        return result;
    }

    return entities;
}

// const command = {
//     commands:[
//         {
//             name: 'SELECT_BY_ID',
//             id: SELECT_BY_ID,
//             argCount: 1,
//             command: commandSelectById,
//             dsl:{
//                 selectById: dslSelectById   
//             }
//         }
//     ]
// };


register(SELECT_BY_ID, commandSelectById, {selectById:dslSelectById});