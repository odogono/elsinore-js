var Entity = require('./entity');
var _ = require('underscore');
var Backbone = require('backbone');
var BitArray = require('bit-array');
var ComponentDef = require('./component_def');
var Utils = require('./utils');

/**
 * An EntitySet is a container for entities
 *
 * it keeps track of entities which have components it is interested in
 */
var EntitySet = Backbone.Model.extend({
    defaults:{
        // name: 'items',
        start: 0, // the starting index
        page: 1, // the current page index
        page_size: 10, // the number of items in each page
        entity_count: 0, // the total number of entities
        page_count: 0, // the number of 'pages'
        status:'atv' //jstonkers.Status.ACTIVE
    },

    initialize: function( attrs, options ){
        var self = this;
        options || (options = {});
        this.registry = options.registry;
        this.storage = options.storage;

        this._reset();

        if( options.componentDefs ){
            this.setMemberComponentDefs( options.componentDefs ); 
        }
    },

    _reset: function(){
        // the ids of componentDefs that this entityset is interested in
        this._componentDefIds = [];
        this._componentDefs = new BitArray();

        this._entityIds = []; // an array of entity ids that maintain the order that they were added
        this.models = []; // an array of entity objects that maintain the order that they were added
        this._entities = []; // an array of entity ids objs to entity objs
        this._entityComponents = []; // an array of entity ids to component arrays
        this._componentsByType = []; // an array of componentDef ids mapped to arrays of entities
    },

    destroy: function(){
        this._componentsByType = null;
        this._entityComponents = null;
        this._entities = null;
        this._entityIds = null;
        this._componentDefIds = null;
        this.storage = null;
        this.registry = null;
    },


    at: function(index) {
        var entityId = this._entityIds[index];
        return entityId ? this._entities[ entityId ] : null;
    },

    setMemberComponentDefs: function( componentDefs, callback ){
        componentDefs = this.registry.getComponentDefs( componentDefs );
        this._componentDefIds = _.map( componentDefs, function(componentDef){
            // log.debug('mapped in ' + componentDef.defId + ' for ' + componentDef.schema.id );
            return componentDef.defId;
        });

        if( callback ){
            return this.reload( callback );
        }
    },


    /**
     * Returns true if the given componentDef is of interest
     * to this entityset
     * 
     * @param  {[type]} componentDef [description]
     * @return {[type]}              [description]
     */
    isComponentOfInterest: function( component ){
        return this._componentDefIds.length == 0 ||
            _.contains( this._componentDefIds, component.id );
    },

    isComponentDefOfInterest: function( componentDef ){

    },


    addComponent: function(component, options){
        var self = this, silent, entityId, entity, componentDef, componentArray;
        options || (options = {});
        silent = options.silent;
        entity = options.entity;

        if( _.isArray(component) ){
            return _.each( component, function(com){
                return self.addComponent( com, options );
            })
        }

        if( !entity )
            entity = this.addEntity( component.getEntityId() );
        componentDef = component.getComponentDef();

        // make a note of the component on the entity
        entity.addComponent( component );

        // set the componentDef onto the Entity, so we have a quick way of seeing what we have

        // add to list of all components
        componentArray = this._componentsByType[ componentDef.id ] || [];

        this._componentsByType[ componentDef.id ] = componentArray;

        if( !silent ){
            this.trigger('add:component', component, componentDef.id, entity.id );
        }

        return this;

        // add to map of componentdef.id to array of components

        /*
        var validate = _.isUndefined( options.validate ) ? true : options.validate;
        if( validate == false && !this.isComponentOfInterest(component) ){
            return;
        }

        var entityId = entity ? entity.id : component.entityId;

        // add mapping of entityId -> entityObj
        entity = Entity.toEntity(entity);

        if( !this._entities[entityId] ){
            this._entityIds.push( entityId );
        }
        this._entities[ entityId ] = entity;
        entity.registry = this.registry;

        // add to the mapping of entityId -> componentDef
        var components = this._entityComponents[ entityId ] || [];
        components[ component.defId ] = component;
        this._entityComponents[ entityId ] = components;

        // self.entities.add( entity );
        // if( component.defId == '/component/poi' )
            // log.debug('es ' + this.cid + ' ent ' + entityId + ' component:add ' + component.defId + ' ' + component.schemaId + ' ' + component.get('title') );
        var componentsByEntity = this._componentsByType[ component.defId ];
        if( !componentsByEntity ){
            this._componentsByType[ component.defId ] = componentsByEntity = [];
        }
        componentsByEntity[ entityId ] = component;
        //*/
    },

    /**
    *
    */
    removeComponent: function( component, options ){
        options || (options = {});
        var entity = this.getEntity( component.getEntityId() );
        var silent = options.silent;

        if( !entity ){
            // the entity doesn't belong
            return;
        }

        if( !entity.hasComponent( component ) ) {
            return;
        }

        entity.removeComponent( component );

        this.trigger('component:remove', component );
        
        if( !entity.hasComponents() ){

            this.removeEntity( entity );
        }
        
        return this;
    },

    // _removeComponent: function(component,entity,options){
    //     var self = this;
    //     if( !this.isComponentOfInterest(component) ){
    //         return;
    //     }

    //     // remove from entityId -> componentDef
    //     var components = this._entityComponents[ entity.id ];
    //     if( components ){
    //         if( _.size(components) <= 0 ){
    //             delete this._entities[ entity.id ];
    //             // search the entity ids for the index to remove
    //             for( var i=0;i<this._entityIds.length;i++ )
    //                 if( this._entityIds[i] == entity.id ){
    //                     this._entityIds.splice(i,1);
    //                 }
    //         }
    //         delete components[ component.defId ]; // = null;
    //     }

    //     // self.entities.remove( entity );
    //     // log.debug('es ' + this.cid + ' component:remove ' + component.defId + ' ' + entity.id );
    //     var componentsByEntity = this._componentsByType[ component.defId ];
    //     if( componentsByEntity ){
    //         delete componentsByEntity[ entity.id ];// = null;
    //     }
    // },

    /**
    *
    */
    addEntity: function( entity, options){
        var self = this, entityId, existingEntity, silent, processComponents;
        var addComponentOptions;

        if( _.isArray(entity) ){
            return _.each( entity, function(e){
                return self.addEntity(e,options);
            })
        }
        
        options || (options = {});
        silent = options.silent;
        processComponents = options.addComponents;

        entity = Entity.toEntity( entity );
        entityId = entity.id;
        existingEntity = this._entities[ entityId ];

        if( existingEntity )
            return existingEntity;

        existingEntity = Entity.toEntity( entityId );

        this._entityIds.push( entityId );
        this.models.push( existingEntity );

        // add to map of entityId to entity instance
        this._entities[ entityId ] = existingEntity;

        if( !silent ){
            this.trigger('add:entity', entityId );
        }

        if( processComponents && entity.components.length > 0 ){
            addComponentOptions = { entity: existingEntity };
            _.each( entity.components, function(com){
                self.addComponent( com, addComponentOptions );
            });
        }

        return existingEntity;
    },

    hasEntity: function( entity ){
        return getEntity( entity ) != null;
    },

    /**
    *
    */
    removeEntity: function(entity, options){
        var entityId, existingEntity, silent, index;

        options || (options = {});
        silent = options.silent;
        entity = Entity.toEntity( entity );
        entityId = entity.id;
        existingEntity = this._entities[ entityId ];

        if( !existingEntity ){
            return null;
        }

        // remove the entity from the set
        delete this._entities[ entityId ];

        index = _.indexOf( this._entityIds, entityId );
        if( index > -1 ){
            this._entityIds.splice( index, 1 );
            this.models.splice( index, 1 );
        }

        if( !silent ){
            this.trigger('remove:entity', entityId );
        }

        return existingEntity;
    },

    getEntity: function( entity, options ){
        var entityId, entity, existingEntity;
        entityId = Utils.isInteger( entity ) ? entity : entity.id;
        // entity = Entity.toEntity( entity );
        existingEntity = this._entities[ entityId ];

        return existingEntity;
    },

    /**
    *   Reloads entities and associated components from storage
    */
    // reload: function(callback){
    //     var self = this;
    //     this.storage.retrieveComponents( this.componentDefs, null, function(component){
    //         self._addComponent( component );
    //     }, function(err){
    //         return callback( err, self );
    //     });
    // },


    // setComponentDefs: function(componentDefs){
    //     this.componentSchemaIds = _.map(componentDefs, function(def){ 
    //         return def.schema.id;
    //     });
    //     this.componentDefIds = _.map(componentDefs, function(def){ 
    //         return def.defId;
    //     });
    // },


    /**
     * Returns a component for a given entity
     * 
     * @param  {[type]} componentDefId [description]
     * @param  {[type]} entity         [description]
     * @return {[type]}                [description]
     */
    // getComponent: function( componentDefId, entity ){
    //     var componentDef = this.registry.getComponentDef( componentDefId );

    //     var entity = Entity.toEntity( entity );
    //     // log.debug('es.getComponent:' + componentDef.schema.id + ' entity:' + entity.id );
        
    //     var componentDefsForEntity = this._entityComponents[ entity.id ];
    //     if( componentDefsForEntity ){
    //         return componentDefsForEntity[ componentDef.id ];
    //     }

    //     // var componentsByEntity = this._componentsByType[ componentDef.id ];
    //     // if( componentsByEntity ){
    //     //     return componentsByEntity[ entity.id ];
    //     // }
    //     return null;
    // },

    /**
     * If an entity belongs to this set, returns the entity id
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    // hasEntity: function( entityId ){
    //     return this._entityComponents[ entityId ] ? entityId : null;
    // },

    // getEntity: function( index ){
    //     return this._entities[ this._entityIds[index] ];
    // },


    // getEntityIds: function(){
    //     return this._entityIds;
    // },

    /**
     * 
     * @param  {[type]} iterator [description]
     * @param  {[type]} context  [description]
     * @return {[type]}          [description]
     */
    // forEach: function(iterator, callback){
    //     var self = this;
    //     if( !callback ){
    //         for( var i=0;i<this._entityIds.length;i++ ){
    //             iterator( self._entities[ self._entityIds[i] ], self );
    //         }
    //         return;
    //     }
    //     return async.eachSeries( _.values(self._entityIds), function(eId, cb){
    //         return iterator( self._entities[eId], self, cb );
    //     }, callback);
    // }
});


EntitySet.prototype.__defineGetter__('length', function(){
    return this._entityIds.length;
    // return 0;
});

_.each( ['forEach', 'each', 'map', 'where', 'filter'], function(method){
    EntitySet.prototype[method] = function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift( this.models );
        // console.log( method + ' ' + JSON.stringify(_.toArray(args)) );
        // return this.models[method].apply( this.models, arguments );
        return _[method].apply( _, args );
    };
});

// var methods = ['forEach', 'each', 'map'];
// _.each(methods, function(method) {
//     Collection.prototype[method] = function() {
//         var args = slice.call(arguments);
//         args.unshift(this.models);
//         return _[method].apply(_, args);
//     };
// });

EntitySet.create = function(attrs, storage, registry, options){
    options = options || {};
    var Model = options.Model || exports.Model;
    var result = new EntitySet(attrs,{storage:storage, registry:registry});
    return result;
};


// module.exports = {
//     EntitySet: EntitySet,
//     Model:EntitySet,
//     create:EntitySet.create 
// };

module.exports = EntitySet;