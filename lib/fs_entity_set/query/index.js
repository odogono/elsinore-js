'use strict';

var _ = require('underscore');

var Q = require('../../query');

/**

the ES maintains indexes based on the queries that get passed in.

*/



/**
*   filters the given entityset with the given entityfilter returning
*   a new entityset
*/
var memoryFilterEntitySet = Q._filterEntitySet;
Q._filterEntitySet = function( context, entitySet, entityFilter, options ){
    var ii,len, filter, entities;
    
    // if this is a memory based ES - then defer to previous definition
    if( !entitySet.isFileSystemEntitySet){
        return memoryFilterEntitySet.call( this, arguments );
    }

    // do we already have this filter?

    // var componentPaths;

    log.debug('filters hash ' + JSON.stringify(entityFilter) + ' ' + entityFilter.hash() );

    entities = [];

    /*
        ALL - generate a list of entities
        A&B - build a list of A and B
    */
    
    for( ii=0,len=entityFilter.filters.length;ii<len;ii++ ){
        filter = entityFilter.filters[ii];
        log.debug('filter ' + filter.type + ' ' + filter.bitField.toValues() );

        if( filter.type === Q.ALL ){
            entities = entities.concat( entitySet.retrieveEntitiesByComponent(filter.bitField.toValues()) );
        }
        // this._getComponentSchema( )
        // if( !EntityFilter.accept( filter.type, ebf, filter.bitField, false ) ){
            // return false;
        // }
    }
    
    // Promise.all

    throw new Error('oh not impl');
}

module.exports = Q;