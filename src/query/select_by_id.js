'use strict';

import _ from 'underscore';
const Q = require('./index');
const EntitySet = require('../entity_set');
import * as Utils from '../util'

const SELECT_BY_ID = 100;


_.extend( EntitySet.prototype, {
    selectById: function( entityIds, returnAsEntitySet ){
        let result;
        returnAsEntitySet = (returnAsEntitySet === undefined) ? true : returnAsEntitySet;
        result = selectById( this.getRegistry(), this, entityIds, returnAsEntitySet );
        return result;
    }
});


function dslSelectById( entityIds, selectFromRoot=false ){
    const context = Q.readContext( this, false );

    context.pushVal( Q.LEFT_PAREN );
    
    context.pushVal( entityIds, true );
    context.pushVal( selectFromRoot, true );

    context.pushVal( Q.RIGHT_PAREN );

    context.pushOp( Q.SELECT_BY_ID );

    return context;
}


function commandSelectById( context, entityIds, selectFromRoot ) {
    let ii, len, value, entity, entities;
    let entitySet;

    // console.log('>entityIds: ' + Utils.stringify(entityIds) );
    // console.log('>selectFromRoot: ' + Utils.stringify(selectFromRoot) );
    selectFromRoot = Q.valueOf(context,selectFromRoot);
    // console.log('<<<');
    // printIns( context );
    // entitySet = selectFromRoot ? context.root : Q.resolveEntitySet( context, entitySet );
    entitySet = selectFromRoot ? context.root : Q.resolveEntitySet( context, context.last );

    if( !entitySet ){
        entitySet = context.root;
    }

    // console.log('entityIds: ' + JSON.stringify(entityIds) );
    entityIds = Q.valueOf( context, entityIds );

    // console.log('using es ' + Utils.stringify(selectFromRoot) + ' ' + entitySet.length );
    // console.log('entityIds: ' + JSON.stringify(entityIds) );
    // printIns( entitySet );

    // 
    if( !entityIds ){
        entityIds = Q.valueOf( context, context.last );
        // console.log('entityIds: ' + JSON.stringify(entityIds) );
    }

    if( !entityIds ){
        throw new Error('no entity ids supplied');
    }

    // printE( context.last );
    // console.log('selectFromRoot ' + selectFromRoot + ' ' + entitySet.cid + ' ' + context.last.cid );
    // process.exit();

    value = selectById( context.registry, entitySet, entityIds, true );

    return (context.last = [ Q.VALUE, value ]);
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
        result = registry.createEntitySet( null, {register:false} );
        result.addEntity( entities );
        return result;
    }

    return entities;
}

const command = {
    commands:[
        {
            name: 'SELECT_BY_ID',
            id: SELECT_BY_ID,
            argCount: 1,
            command: commandSelectById,
            dsl:{
                selectById: dslSelectById   
            }
        }
    ]
};


Q.registerCommand( command );
module.exports = Q;