'use strict';

var _ = require('underscore');

var Q = require('../../query');

/**

the ES maintains indexes based on the queries that get passed in.

*/



/**
*   Produces another entityset subject to the passed filters
*/
var memoryFilterEntitySet = Q._filterEntitySet;
Q._filterEntitySet = function( context, entitySet, entityFilter, options ){
    if( !entitySet.isFileSystemEntitySet){
        return memoryFilterEntitySet.call( this, arguments );
    }
    log.debug('filters hash ' + entityFilter.hash() );
    // printIns( arguments,1 );
    // printIns( filters );
    throw new Error('oh not impl');
}

module.exports = Q;