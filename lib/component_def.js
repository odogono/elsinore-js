var _ = require('underscore');
_.str = require( 'underscore.string' );
var Backbone = require('backbone');
var Component = require('./component');

var ComponentDef = Backbone.Model.extend({
});

function isComponentDef( obj ){
    return ( obj != null && typeof obj === 'object' && obj instanceof ComponentDef );
}

/**
*   schema registry is required to look up the schema properties
*/
function create( schema, attrs, defaultAttrs, options ){
    // if( _.isObject(schema) ){
    //     schema = schemaRegistry.register( schema ).get(schema.id);
    // } else {
    //     schema = schemaRegistry.get(schema);
    // }

    // var schema = parseSchema( schema );
    var result = createComponentDef( schema, attrs, defaultAttrs, options );
    return result;
}

// var parseSchema = function(schema){
//     if( !schema )
//         return null;
//     if( _.isString(schema) ){
//         schema = { id:schema };
//     } else if (typeof schema === 'object') {
//         if( schema.schema ){
//             schema = schema.schema;
//         } else{
//         }
//     }

//     return schema;
// }


function nameFromSchema( schema, suffix ){
    suffix = _.isUndefined(suffix) ? '_com_def' : suffix;
    var name = _.isString(schema) ? schema : schema.name || schema.id; 
    name = name.split('/').pop();
    return _.str.classify( name + suffix );
};

var createComponentDef = function( schema, attrs, defaultAttrs, options ){
    // instantiate the Def and assign it
    // references
    var componentDef = new ComponentDef();
    componentDef.schema = schema;
    componentDef.name = nameFromSchema( schema );
    
    // Create the Component Class
    var componentClass = componentDef.ComponentClass = Component.Model.extend({
        defaults:_.extend({},defaultAttrs)
    },{ 
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