import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import {
    hash
} from '../util'

import Query from '../query';
import EntitySet from '../entity_set';

// export default {Query as Query};


_.extend( EntitySet.prototype, {
    setQuery: function( query ){
        this._query = null;
        if( !query ){
            return;
        }
        if( query instanceof Query ){
            if( query.isEmpty() ){
                return;
            }
            
            this._query = new Query( query );
            return;
        }
        if( _.isFunction(query) ){
            this._query = new Query( query );
        }
    },

    getQuery: function(){
        return this._query;
    },

    /**
    *   Executes a query against the entityset and returns
    *   a new entityset with the results
    */
    query: function( query, options={} ){
        // console.log('executing query', query);
        options.registry = this.getRegistry();        
        if( !query ){
            query = Q => Q.root();// Query.root();
        }
        if( query instanceof Query ){
            return query.execute(this,options);
        }
        return Query.exec( query, this, options );
    },

    /**
    *   Removes the entities identified by the query
    */
    removeByQuery: function( query, options ){
        const result = Query.exec( query, this, _.extend({},options,{registry:this.getRegistry()}));
        return this.removeEntity( result );
    },
});

EntitySet.hash = function( entitySet, query ){
    let result = entitySet.type;
    if( query ){
        result += query.hash();
    }
    return hash( result, true );
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

