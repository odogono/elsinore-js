var _ = require('underscore');
var BitField = require('../bit_field');
var LevelEntitySet = require('./index');
var Query = require('../query');
var Utils = require('../utils');
var CC = require('./constants');
var LU = require('./utils');

function LevelDbQuery(){}
function LevelDbQueryContext(){}

// _.extend( LevelDbQuery, Query, {
//     poop: function(){
//         // Query.poop();
//         console.log('parp LDbQuery');
//     },

//     _filterEntitySet: function( context, entitySet, entityFilter, options ){
//         throw new Error('Bah! ' + entitySet.type );
//     }
// });

LevelDbQueryContext.prototype.componentsToBitfield = function( context, components ){
    var componentIds, result;
    componentIds = context.registry.getIId( components, true );
    result = BitField.create();
    result.setValues( componentIds, true );
    log.debug('lookup ' + Utils.stringify(components) + ' ' + result );
    return result;
}


LevelDbQueryContext.prototype.filterEntitySet = function( context, entitySet, entityFilter, options ){
    var result;
    // strategy: build lists of entities using the provided filter
    // log.debug('LevelDbQuery.filterEntitySet ' + entityFilter.constructor.name + ' ' + Utils.stringify(entityFilter));
    // let ctx = Query.createContext( context );
    // log.debug( 'created ' + ctx.constructor.name + ' from ' + context.constructor.name );
    result = context.registry.createEntitySet( null, {register:false} );

    // var key = /*CC.ENTITY_ID_BITFIELD*/ LU.key( CC.ENTITY_COMPONENT, 4294967348 );

    // return LU.printKeys( entitySet._db, null, {
    //     gte: key + CC.KEY_START,
    //     lte: key + CC.KEY_LAST
    // })
    // .then( function(){
    return LU.readStream( entitySet._db,{
        gte: CC.ENTITY_ID_BITFIELD + CC.KEY_START,
        lte: CC.ENTITY_ID_BITFIELD + CC.KEY_LAST,
        dataFn: function( result, data ){
            result = result || [];
            var bf = data.key.split(/!/)[2];
            bf = BitField.create( bf );
            // log.debug('check bf ' + bf );
            if( entityFilter.accept(bf) ){
                // log.debug('oh hai ' + JSON.stringify(data) + ' ' + bf );
                result.push( data.value );
            }
            return result;
        }
    })// })
    .then( function(entityIds){
        return _.reduce( entityIds, function(current, eid){
            return current.then(function( accum ){
                // log.debug('reading entity ' + eid );
                return entitySet._readEntityById( eid )
                    .then( function(entity){ result.addEntity(entity); });
            });
        }, Promise.resolve() )
    })
    // .then( function(entities){
    //     // printIns( entities, 1);
    //     return result.addEntity( entities )
    // })
    .then( function(){
        return result;
    });
}




LevelDbQuery.execute = function( entity, query, options ){
    var ii, len, command, context, result;
    
    options = options || {};
    options.context = LevelDbQueryContext;

    // build the initial context object from the incoming arguments
    context = Query.buildContext( entity,query,options);

    query = Query.compile( context, query, options );

    // if( context.debug ){log.debug('commands:'); printIns( query,1 ); }

    for( ii=0,len=query.commands.length;ii<len;ii++ ){
        command = query.commands[ii];
        // log.debug('go ' + Utils.stringify(command) );

        // the actual result will usually be [VALUE,...]
        result = Query.executeCommand( context, command )[1];
    }

    return result;
}

LevelEntitySet.Query = LevelDbQuery;
module.exports = LevelDbQuery;