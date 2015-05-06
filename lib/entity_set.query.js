'use strict';

var _ = require('underscore');

var EntityFilter = require('./entity_filter');

/**
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/
function Query(){}

var QueryFunctions = {

    select: function( entityFilter, replace ){
        let componentUri;
        if( EntityFilter.isEntityFilter( entityFilter ) ){
        }
        else if( _.isString(entityFilter) ){
            componentUri = this.registry.getIId( entityFilter );
            entityFilter = EntityFilter.create( EntityFilter.ALL, componentUri );
        } else {
            return this;
        }

        if( this.entityFilter ){
            this.entityFilter.add( entityFilter );
        } else {
            this.entityFilter = entityFilter;
        }

        return this;
    },

    filterByComponent: function( filterType, components ){
        return this;
    },

    filter: function( filterFunction ){
        this.entityFilter.add( filterFunction );
        return this;
    },

    filterByAttr: function( componentUri, attrs ){
        var attrArray;
        var componentIId = this.registry.getIId( componentUri );

        this.componentAttrFilter = (this.componentAttrFilter || {});
        attrArray = this.componentAttrFilter[ componentIId ] || [];
        attrArray.push( attrs );
        this.componentAttrFilter[ componentIId ] = attrArray;

        return {
            count: this.count,
            execute: this.execute,
        }
    },

    /**
    *   
    */
    retrieveEntity: function( componentUri, entityField ){
        return {
            execute: this.execute
        }
    },

    
    attr: function( attrName ){
        var self = this;
        return {
            equals: function( value ){
                console.log('attr ' + this.attrName + ' should equal ' + value );
                return {
                    execute: self.execute
                }
            },
        }
    },

    count: function( count ){
        this.count = count;
        return {
            execute: this.execute,
        }
    },

    execute: function(){
        return this.entitySet._runQuery( 
            this.entityFilter,
            this.filters,
            this.componentAttrFilter );
    }
};

var NonThisQueryFunctions = {
    

};

_.extend( Query.prototype, QueryFunctions, {
    isQuery: true,
    type: 'Query',
});

_.extend( Query.prototype, NonThisQueryFunctions );

Query.selectByComponent = function( componentUri ){

};


Query.isQuery = function( query ){
    return query && query.isQuery;
}



Query.create = function( entitySet ){
    var result = new Query();
    
    // bind all the functions to the Query instance so that we can
    // return selected functions
    _.bindAll.apply( _, [result].concat(_.keys(QueryFunctions)) );

    result.entitySet = entitySet;
    result.registry = entitySet.getRegistry();
    result.filters = [];
    
    return result;
}


module.exports = Query;