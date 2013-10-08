var JsonSchema = require('./schema');


/**
 * Components contain data
 * @type {[type]}
 */
var Component = exports.Model = Backbone.Model.extend({
    parse: function( resp, options ){
        if( !resp || _.keys(resp).length <= 0 )
            return resp;

        return resp;
    }
});


exports.create = function(options){
    var com = new Component();
    return com;
}


exports.isComponentDef = function( obj ){
    if( obj != null && typeof obj === 'object' && obj.schema && obj.create ){ //obj instanceof Component.ComponentDef ){//
        return true;
    }
    // defId instanceof Component.ComponentDef
    return false;
}


exports.isComponent = function(obj){
    if( obj != null && _.isObject(obj) && obj instanceof Component ){
        return true;
    }
    return false;
}

exports.ComponentDefNameFromSchema = function( schema ){
    var name = _.isString(schema) ? schema : schema.title || schema.id; 
    name = name.split('/').pop();
    return _.classify( name + '_com_def' );
};

exports.createComponentDef = function( def, name, schema, options ){
    // instantiate the Def and assign it
    // references
    def = def || new ComponentDef();
    def.name = name;
    def.schema = schema;
    def.schemaId = schema.id;
    
    // Create the Component Class
    var component = def.Component = Component.extend({},{ 
        // assign class properties
        componentDef:def,
    });

    // ensure the component and def have a create function
    def.create = /*def.Component.create = */def.create || function(attrs, options){
        var result = new component(attrs,options);
        result._debug_is_component = true;
        return result;
    };

    // ensure the component and def have a parse function
    def.parse = /*def.Component.parse =*/ def.parse || function( resp, options){
        var result = def.create();
        result.set( result.parse(resp,options) );
        return result;
    };

    return def;
}