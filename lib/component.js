var tv4 = require('tv4').tv4;

/**
 * Components contain data
 * @type {[type]}
 */
var Component = exports.Component = Backbone.Model.extend({

});


exports.create = function(options){
    var com = new Component();
    return com;
}


var ComponentDef = exports.ComponentDef = function(){
};



/**
 * [ description]
 * @return {[type]} [description]
 */
var ComponentRegistry = function(){
    this._reset();
};

var ComponentDefNameFromSchema = function( schema ){
    var name = _.isString(schema) ? schema : schema.title || schema.id; 
    name = name.split('/').pop();
    return _.classify( name + '_com_def' );
};


_.extend(ComponentRegistry.prototype, Backbone.Events, {

    _reset: function(){
        this._defId = 1;
        this._defsBySchemaId = {};
        this._defs = [];
        this._comId = 1;
        this._components = []; // an array of all created component instances
    },

    /**
     * Registers a new Component
     * @param  {[type]} schema [description]
     * @return {[type]}        [description]
     */
    register: function( schema, options ){
        var self = this, def;
        if( _.isString(schema) ){
            schema = { id:schema };
        } else if (typeof schema === 'object') {
            if( schema.schema ){
                def = schema;
                schema = def.schema;
            }
        }

        tv4.addSchema( schema.id, schema );
        var defName = ComponentDefNameFromSchema( schema );

        def = def || new ComponentDef();
        def.name = defName;
        def.schema = schema;
        def.registry = this;

        def.defId = this._defId++;

        this._defsBySchemaId[ schema.id ] = def;
        this._defs[ def.defId ] = def;

        var component = def.Component = Component.extend({},{ 
            // assign class properties
            componentDef:def,
        });

        // ensure the component and def have a create function
        def.create = /*def.Component.create = def.create ||*/ function(attrs, options){
            var result = new component(attrs,options);
            result.comId = self._comId++;
            self._components[ result.comId ] = result;
            // self._components.push( result );
            return result;
        }

        // ensure the component and def have a parse function
        def.parse = def.Component.parse = def.parse || function( resp, options ){
            var result = def.create();
            result.set( result.parse(resp,options) );
            return result;
        }

        this.trigger('register', def, this, options );

        return def;
    },

    /**
     * Unregisters an existing component
     * @return {[type]} [description]
     */
    unregister: function(){
        this.trigger('unregister');
    },

    getComponentDef: function( defId ){
        if( typeof defId === 'number' && defId % 1 == 0 ){
            return this._defs[ defId ];
        }
        else if( typeof defId === 'object' ){
            if( defId instanceof ComponentDef )
                return defId;
        }
        else if( _.isString(defId) )
            return this._defsBySchemaId[ defId ];
        return null;
    },

    /**
     * Creates a new component instance
     * 
     * @param  {[type]} schemaId [description]
     * @return {[type]}          [description]
     */
    create: function( schemaId, attrs, options ){
        var def = this.getComponentDef( schemaId );
        if( !def )
            return null;
        var com = def.create( attrs, options );
        return com;
    },

    /**
     * Returns all component instances of a given schemaId
     * 
     * @param  {[type]} schemaId [description]
     * @return {[type]}          [description]
     */
    select: function( schemaId ){
        var def = this.getComponentDef( schemaId );
        return _.select( this._components, function(com){
            return com.constructor.componentDef === def;
        });
    }
    
});

exports.ComponentRegistry = {

    create: function(options){
        var cr = new ComponentRegistry();
        return cr;
    }
};