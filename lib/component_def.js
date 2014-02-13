var _ = require('underscore');
_.str = require( 'underscore.string' );
var Backbone = require('backbone');
var Component = require('./component');

var ComponentDef = Backbone.Model.extend({

});

var isComponentDef = function( obj ){
    return ( obj != null && typeof obj === 'object' && obj instanceof ComponentDef );
}

var create = function(data,options){
    // parse the incoming data
    var schema = parseSchema( data );

    var result = createComponentDef( schema, options );

    return result;
}



var parseSchema = function(schema){
    if( !schema )
        return null;
    if( _.isString(schema) ){
        schema = { id:schema };
    } else if (typeof schema === 'object') {
        if( schema.schema ){
            schema = schema.schema;
        } else{
            // schema = {};
        }
    }

    return schema;
}


var nameFromSchema = function( schema, suffix ){
    suffix = _.isUndefined(suffix) ? '_com_def' : suffix;
    var name = _.isString(schema) ? schema : schema.id; 
    name = name.split('/').pop();
    return _.str.classify( name + suffix );
};

var createComponentDef = function( schema, options ){
    // instantiate the Def and assign it
    // references
    var componentDef = new ComponentDef();
    componentDef.schema = schema;
    componentDef.name = nameFromSchema( schema );
    
    // Create the Component Class
    var componentClass = componentDef.ComponentClass = Component.Model.extend({},{ 
        // assign class properties
        componentDef:componentDef,
    });

    // ensure the component and def have a create function
    componentDef.create = /*componentDef.Component.create = */componentDef.create || function(attrs, options){
        var result = new componentClass(attrs,_.extend({},options,{parse:true}));
        result._debug_is_component = true;
        return result;
    };

    // ensure the component and def have a parse function
    componentDef.parse = /*componentDef.Component.parse =*/ componentDef.parse || function( resp, options){
        var result = componentDef.create();
        result.set( result.parse(resp,options) );
        return result;
    };

    return componentDef;
}

module.exports = {
    Model: ComponentDef, ComponentDef: ComponentDef,
    nameFromSchema: nameFromSchema,
    isComponentDef: isComponentDef,
    create: create
}