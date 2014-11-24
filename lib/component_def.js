var _ = require('underscore');
var Backbone = require('backbone');
var Component = require('./component');

var ComponentDef = Backbone.Model.extend({
    // get: function(attr) {
    //     var base = Backbone.Model.prototype.get;
    //     if( attr == 'schemaId' ){
    //         var schema = base.call(this, 'schema');
    //         if( _.isString(schema) ){
    //             return schema;
    //         } else if( typeof schema === 'object' && schema.id ){
    //             return schema.id;
    //         }
    //     }
    //     return base.call(this, attr);
    // },
    getSchema: function(){
        return this.get('schema');
    },

    getSchemaId: function( schemaId ){
        var schema = this.get('schema');
        if( _.isString(schema) ){
            return schema;
        } else if( typeof schema === 'object' && schema.id ){
            return schema.id;
        }
        return null;
    },

    getHash: function(){
        return this.get('hash');
    },

    getName: function(){
        return this.get('name');
    },
});

ComponentDef.isComponentDef = function isComponentDef( obj ){
    return ( obj != null && _.isObject(obj) && obj instanceof ComponentDef );
}

ComponentDef.getId = function getId( obj ){
    if( Component.isComponent(obj) ){
        var def = Component.getComponentDef( obj );
        if( def )
            return def.id;
        return null;
    }
    return ComponentDef.isComponentDef( obj ) ? obj.id : obj;
}

/**
*   schema registry is required to look up the schema properties
*/
ComponentDef.create = function create( schema, attrs, defaultAttrs, options ){
    // instantiate the Def and assign it
    // references
    var cdParams = {
        schema:schema, 
        className:ComponentDef.nameFromSchema(schema),
        name:ComponentDef.nameFromSchema(schema, '')
    };
    if( options && options.id ){
        cdParams.id = options.id;
    }

    var componentDef = new ComponentDef();
    componentDef.set(cdParams);
    
    // Create the Component Class
    var componentClass = componentDef.ComponentClass = Component.extend({
        defaults:_.extend({},defaultAttrs)
    },{ 
        // assign class properties
        ComponentDef:componentDef,
    });

    // ensure the component and def have a create function
    componentDef.create = /*componentDef.Component.create = */componentDef.create || function(attrs, options){
        var result = new componentClass(attrs,_.extend({},options,{parse:true}));
        result._debug_is_component = true;
        result.ComponentDef = componentDef;
        return result;
    };

    return componentDef;
}



ComponentDef.nameFromSchema = function nameFromSchema( schema, suffix ){
    if( ComponentDef.isComponentDef(schema) ){
        schema = schema.get('schema');
    }
    suffix = _.isUndefined(suffix) ? '_com_def' : suffix;
    var name = _.isString(schema) ? schema : schema.name || (schema.id + ''); 
    name = name.split('/').pop();
    return _.str.classify( name + suffix );
};

module.exports = ComponentDef;