'use strict';

import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import * as Utils from '../util'
var Query = require('../query');
var EntitySet = require('../entity_set');

_.extend( EntitySet.prototype, {
    setQuery: function( query ){
        if( !Query.isQuery ){
            query = Query.create( this.getRegistry(), query );
        }
        this._query = query;
    },
    getQuery: function(){
        return this._query;
    },
    query: function( query, options ){
        if( !query ){
            query = Query.root();
        }
        return Query.execute( this, query, options );
    },
});

EntitySet.hash = function( entitySet, query ){
    var hash = entitySet.type;
    if( query ){
        hash += query.hash();
    }
    return Utils.hash( hash, true );
}

EntitySet.setQuery = function( entitySet, query, options ){
    var filterType;
    var componentIds;
    var args;
    var registry;

    if( !query ){
        throw new Error('invalid filter passed');
    }

    entitySet.setQuery( query );
    
    // check that entities are still allowed to belong to this set
    EntitySet.evaluateEntities( entitySet );
    // query.execute( entitySet, null );

    return entitySet.getQuery();
};

EntitySet.isEntityOfInterest = function( entitySet, entity, options ){
    var tEntity;
    var query;
    query = entitySet.getQuery();

    if( !query ){
        return true;
    }
    tEntity = query.execute( entity );

    if( !tEntity ){
        return false;
    }

    return true;
}

/**
*   Checks through all contained entities, ensuring that they
*   are still valid members of this entitySet
*/
EntitySet.evaluateEntities = function( entitySet, entityIdArray, options ){
    var ii,len,entity, query;
    var entities;
    var removed = [];

    query = entitySet.getQuery();

    if( !query ){
        return removed;
    }

    if( entityIdArray ){
        for( ii=0,len=entityIdArray.length;ii<len;ii++ ){
            entity = entitySet.get( entityIdArray[ii] );
            if( entity && !query.execute( entity ) ){
                removed.push( entity );
            }
        }
    } else {
        entities = entitySet.entities || entitySet;

        for( ii=entities.length-1; ii>=0; ii-- ){
            entity = entities.at(ii);
            if( entity && !query.execute( entity ) ){
                removed.push( entity );
            }
        }
    }

    if( removed.length > 0 ){
        return entitySet.removeEntity( removed, options );
    }
    return removed;
};


/**
*   Transfers entities from src to dst whilst applying the filter
*   The query is then set on the dstEntitySet
*/
EntitySet.map = function( srcEntitySet, query, dstEntitySet, options ){
    var e,i,elen,len;
    var entity;
    options || (options = {});
    
    dstEntitySet.reset();

    if( query ){
        EntitySet.setQuery( dstEntitySet, query );
    }

    dstEntitySet.addEntity( srcEntitySet );

    return dstEntitySet;
};



module.exports = Query;

