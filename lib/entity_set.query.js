'use strict';

var _ = require('underscore');

var EntityFilter = require('./entity_filter');
var BitField = require('./bit_field');
var Utils = require('./utils');


/**
*   Some inspiration taken from https://github.com/aaronpowell/db.js
*/
function Query(){}


_.extend( Query, {
    ALL: 0, // entities must have all the specified components
    ANY: 1, // entities must have one or any of the specified components
    SOME: 2, // entities must have at least one component
    NONE: 3, // entities should not have any of the specified components
    INCLUDE: 4, // the filter will only include specified components
    EXCLUDE: 5, // the filter will exclude specified components
    ROOT: 6,
    EQUALS: 7,
    NOT_EQUAL: 8,
    LESS_THAN: 9,
    GREATER_THAN: 10,
    AND: 11,
    OR: 12,
    VALUE: 13,
    FILTER: 14,
    ADD_ENTITIES: 15,
    ATTR: 16,
    PLUCK: 17,
    ALIAS: 18,
    DEBUG: 19,
    PRINT: 20,
    SELECT_BY_ID: 21,
    WITHOUT: 22,
    NOOP: 23,
});


/*

    FILTER <es> <filter> - selects a subset of entities from <es> using <filter>

    EQ <op1> <op2> - ensures that the value(s) in op1 equal op2

    ALIAS <op1> - selects the value stored in <op1>

    ALIAS <op1> <op2> - stores the value in <op2> into <op1>

    PLUCK <op1> <op2> - selects the attributes in <op2> from the es in <op1>

    ATTR <op1> <op2> - selects the attribute(s) in <op2> from the component(s) in <op1>

    LIMIT <op1> - limits the number of entities returned to <op1>

    LIMIT <op1> <op2> - selects <op1> number of entities from the offset <op2>

  // ElsinoreQL intermediate language
  [ FILTER, 
    ROOT, 
    [ ALL, '/channel_member' ] ]

  [ FILTER, 
    ENTITY_SET,
    USER_FN ]

  [ FILTER, // each e in the es is filtered using the 3rd arg
    ENTITY_SET,
    [ EQ, 
        [ ATTRIBUTES, ['/channel_member'], ['client'] ], 
        [ VALUEOF, 11 ] ]

  [ ADD_ENTITIES,
    ROOT,
    [ VALUEOF, 
        [ ATTRIBUTES, ['/channel_member'], ['client', 'channel'] ] ] ]

*/
var QueryFunctions = {

    select: function( entityFilter, replace ){
        var componentIId;
        this.entityFilter = (this.entityFilter || EntityFilter.create());
        if( EntityFilter.isEntityFilter( entityFilter ) ){
            this.entityFilter.add(  entityFilter );
        }
        else if( _.isString(entityFilter) ){
            componentIId = this.registry.getIId( entityFilter );
            this.entityFilter.add( EntityFilter.ALL, componentIId );
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

    // filterByAttr: function( componentUri, attrs ){
    //     var attrArray;
    //     var componentIId = this.registry.getIId( componentUri );

    //     this.componentAttrFilter = (this.componentAttrFilter || {});
    //     attrArray = this.componentAttrFilter[ componentIId ] || [];
    //     attrArray.push( attrs );
    //     this.componentAttrFilter[ componentIId ] = attrArray;

    //     return {
    //         count: this.count,
    //         execute: this.execute,
    //     }
    // },

    /**
    *   
    */
    addEntities: function( componentUri, entityField ){
        var componentIId;// = this.registry.getIId( componentUri );

        if( !componentUri ){
            return this;
        }

        

        if( componentUri instanceof ComponentQuery ){

            this.entityQueries = (this.entityQueries || []);
            this.entityQueries.push( componentUri );
        }

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
            this.entityQueries );
    }
};

var NonThisQueryFunctions = {
    

};

_.extend( Query.prototype, QueryFunctions, {
    isQuery: true,
    type: 'Query',
});

_.extend( Query.prototype, NonThisQueryFunctions );


var ComponentQuery = function( componentUri ){
    var self = this;
    this.isComponentQuery = true;
    this.componentUri = componentUri;

    var attr = function(attrs){
        self.attrs = _.isArray(attrs) ? attrs : [attrs];
        return {
            eq: eq
        };
    };

    var eq = function(value){
        return self;
    };

    return {
        attr: attr
    }
}

Query.component = function( componentUri ){
    return new ComponentQuery( componentUri );
}




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