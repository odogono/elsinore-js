var JsonSchema = require('./schema');


/**
 * Components contain data
 * @type {[type]}
 */
var Component = exports.Component = Backbone.Model.extend({

    parse: function( resp, options ){
        if( !resp || _.keys(resp).length <= 0 )
            return resp;

        return resp;
    }
});


// exports.create = function(options){
//     var com = new Component();
//     return com;
// }


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


var middleware = {};


_.extend(ComponentRegistry.prototype, Backbone.Events, {

    _reset: function(){
        this._defId = 1;
        this._defsBySchemaId = {};
        this._defs = [];
        this._comId = 1;
        this._components = []; // an array of all created component instances
    },

    /**
     * Initialises the entity store
     * @param  {[type]}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    initialise: function(options,callback){
        var self = this;
        if( _.isFunction(options) ){
            callback = options;
            options = {};
        }

        if( middleware.initialise ){
            return middleware.initialise( self, options, callback );
        }

        return async.nextTick(function(){
            return callback(null,self);
        });
    },

    _createDef: function( def, name, schema, options ){
        var self = this;
        // instantiate the Def and assign it
        // references
        def = def || new ComponentDef();
        def.name = name;
        def.schema = schema;
        def.registry = this;

        // register the Def
        def.defId = this._defId++;
        this._defsBySchemaId[ schema.id ] = def;
        this._defs[ def.defId ] = def;

        // Create the Component Class
        var component = def.Component = Component.extend({},{ 
            // assign class properties
            componentDef:def,
        });

        // ensure the component and def have a create function
        def.create = /*def.Component.create = */def.create || function(attrs, options,cb){
            if( arguments.length === 1 ){
                cb = attrs; options = {};
            } else if( arguments.length == 2 ){
                cb = options; options = {};
            }
            // log.debug('creating component ' + def.schema.id );
            var result = new component(attrs,options);
            result.comId = self._comId++;
            self._components[ result.comId ] = result;
            return async.nextTick( function(){
                cb(null,result);
            });
        };

        // ensure the component and def have a parse function
        def.parse = /*def.Component.parse =*/ def.parse || function( resp, options, cb ){
            return def.create({}, {}, function(err,result){
                result.set( result.parse(resp,options) );
                return cb(null,result);    
            });
        };

        return def;
    },

    /**
     * [ description]
     * @param  {Object}   schema   [description]
     * @param  {[type]}   def      [description]
     * @param  {Object}   options  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    _register: function( schema, def, options, callback ){
        var self = this;

        JsonSchema.addSchema( schema.id, schema );
        var defName = ComponentDefNameFromSchema( schema );

        // create the Def class
        def = this._createDef(def, defName, schema, options);

        if( middleware.registerComponent ){
            return middleware.registerComponent( def, this, options, callback );
        }

        this.trigger('register', def, this, options );

        return async.nextTick(function(){
            return callback(null, def);
        });
    },

    /**
     * Registers a new Component
     * @param  {Object|Array} schema [description]
     * @return {[type]}        [description]
     */
    registerComponent: function( schemaArray, options, callback ){
        var self = this, 
            isSingle = false, schema;
        if( _.isFunction(options) ){
            callback = options;
            options = {};
        }

        // if we were passed just a object, turn it into
        // an array and make a note, so that we can return
        // an object for the result
        if( !_.isArray(schemaArray) ){
            schemaArray = [schemaArray];
            isSingle = true;
        }

        async.map( schemaArray, function(schema,cb){
            var def;
            if( _.isString(schema) ){
                schema = { id:schema };
            } else if (typeof schema === 'object') {
                if( schema.schema ){
                    def = schema;
                    schema = def.schema;
                }
            }
            return self._register( schema, def, options, cb );
        }, function(err, defs){
            callback(err, (isSingle && defs.length > 0) ? defs[0] : defs );
        });
    },

    /**
     * Unregisters an existing component def
     * This means that all its component instances
     * will be destroyed.
     *
     * 
     * 
     * @return {[type]} [description]
     */
    unregister: function(defId, callback){
        return async.nextTick( function(){
            // this.trigger('unregister');
            return callback('not implemented');
        });
    },

    /**
     * Returns a component definition using
     * some sort of id
     * 
     * @param  {[type]} defId [description]
     * @return {[type]}       [description]
     */
    getComponentDef: function( defId ){
        if( _.isUndefined(defId) )
            return null;
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
    createComponent: function( schemaId, attrs, options, callback ){
        var self = this, 
            def = this.getComponentDef( schemaId );
        if( arguments.length == 3 ){
            callback = options;  options = null;
        }
        else if( arguments.length == 2 ){
            callback = attrs; attrs = null;
        }
        options = options || {};

        if( !def ){
            return async.nextTick( function(){
                return callback('unknown component def ' + schemaId );
            });
        }

        if( middleware.createComponent ){
            return middleware.createComponent( def, attrs, this, options, callback );
        }

        return async.nextTick( function(){
            def.create( attrs, options, function(err,com){
                self.trigger('create', com, def, self, options);
                return callback(null, com);
            });
        });
    },

    /**
     * Calling this indicates that the given
     * component is no longer needed.
     * 
     * @param  {Component} component [description]
     * @return {[type]}           [description]
     */
    free: function( component, callback ){
        var self = this;
        return async.nextTick( function(){
            // first fire the event
            this.trigger('free', component);
            // then perform freeing
            return callback();
        });
    },

    /**
     * Returns all component instances of a given schemaId
     * 
     * @param  {[type]} schemaId [description]
     * @return {[type]}          [description]
     */
    select: function( schemaId, callback ){
        var self = this, 
            def = this.getComponentDef( schemaId );
        return async.nextTick( function(){
            // No schema id provided or def not found - return all components
            if( !def ){
                return callback(null, self._components );
            }
            return callback( null, _.select( self._components, function(com){
                return com.constructor.componentDef === def;
            }));
        });
        
    }
    
});

exports.ComponentRegistry = {
    create: function(options, callback){
        if( _.isFunction(options) ){
            callback = options; options = {};
        }
        options = options || {};
        var cr = new ComponentRegistry();
        if( callback !== undefined ){
            return cr.initialise(options,callback);
        }
        return cr;
    },

    use: function( mw ){
        if( mw && mw.ComponentRegistry ){
            middleware = new mw.ComponentRegistry();
        }
    }
};