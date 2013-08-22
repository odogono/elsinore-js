var Entity = require('./entity');

/**
 * An EntitySet is a container for entities
 *
 * it keeps track of entities which have components it is interested in
 */
var EntitySet = exports.Model = exports.EntitySet = Backbone.Model.extend({
    defaults:{
        // name: 'items',
        start: 0, // the starting index
        page: 1, // the current page index
        page_size: 100, // the number of items in each page
        entity_count: 0, // the total number of entities
        page_count: 0, // the number of 'pages'
        status:'atv' //jstonkers.Status.ACTIVE
    },

    initialize: function( attrs, options ){
        var self = this;
        this.registry = options.registry;
        this.storage = options.storage;

        // the ids of componentDefs that this entityset is interested in
        this._componentDefIds = [];

        this._entities = []; // an array of entity ids
        this._componentsByType = []; // an array of componentDef ids mapped to arrays of entities

        this.listenTo( this.storage, 'component:add', this._addComponent );
        this.listenTo( this.storage, 'component:remove', this._removeComponent );
        this.listenTo( this.registry, 'entity:destroy', this._destroyEntity );

        if( options.componentDefs ){
            this.setMemberComponentDefs( options.componentDefs ); 
        }
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


    _addComponent: function(component, entity, options){
        var self = this;
        if( !this.isComponentOfInterest(component) ){
            log.debug('not interested in ' + component.defId );
            return;
        }

        var entityId = entity ? entity.id : component.entityId;

        // if( !entity ){ log.debug('entity:');print_ins( entity,1 ); }

        // add to the mapping of entityId -> componentDef
        var entityComponents = this._entities[ entityId ] || [];
        entityComponents[ component.defId ] = component;
        this._entities[ entityId ] = entityComponents;


        // self.entities.add( entity );
        log.debug('es ' + this.cid + ' component:add ' + component.defId + ' ' + component.schemaId );
        var componentsByEntity = this._componentsByType[ component.defId ];
        if( !componentsByEntity ){
            // log.debug('created componentsByEntity for ' + component.defId);
            this._componentsByType[ component.defId ] = componentsByEntity = [];
        }
        componentsByEntity[ entityId ] = component;
    },

    _removeComponent: function(component,entity,options){
        var self = this;
        if( !this.isComponentOfInterest(component) ){
            return;
        }

        // remove from entityId -> componentDef
        var entityComponents = this._entities[ entity.id ];
        if( entityComponents ){
            entityComponents[ component.defId ] = null;
        }

        // self.entities.remove( entity );
        log.debug('es ' + this.cid + ' component:remove ' + component.defId + ' ' + entity.id );
        var componentsByEntity = this._componentsByType[ component.defId ];
        if( componentsByEntity ){
            componentsByEntity[ entity.id ] = null;
        }
    },

    _destroyEntity: function( entity, options ){

    },


    /**
    *   Reloads entities and associated components from storage
    */
    reload: function(callback){
        var self = this;
        this.storage.retrieveComponents( this.componentDefs, function(component){
            self._addComponent( component );
        }, function(err){
            return callback( err, self );
        });
    },


    setComponentDefs: function(componentDefs){
        this.componentSchemaIds = _.map(componentDefs, function(def){ 
            return def.schema.id;
        });
        this.componentDefIds = _.map(componentDefs, function(def){ 
            return def.defId;
        });
    },


    /**
     * Returns a component for a given entity
     * 
     * @param  {[type]} componentDefId [description]
     * @param  {[type]} entity         [description]
     * @return {[type]}                [description]
     */
    getComponent: function( componentDefId, entity ){
        var componentDef = this.registry.getComponentDef( componentDefId );
        var entity = this.registry.toEntity( entity );
        log.debug('es.getComponent:' + componentDef.schema.id + ' entity:' + entity.id );
        
        var componentDefsForEntity = this._entities[ entity.id ];
        if( componentDefsForEntity ){
            return componentDefsForEntity[ componentDef.id ];
        }

        // var componentsByEntity = this._componentsByType[ componentDef.id ];
        // if( componentsByEntity ){
        //     return componentsByEntity[ entity.id ];
        // }
        return null;
    },

    /**
     * If an entity belongs to this set, returns the entity id
     * @param  {[type]} entityId [description]
     * @return {[type]}          [description]
     */
    hasEntity: function( entityId ){
        return this._entities[ entityId ] ? entityId : null;
    }

});

EntitySet.prototype.__defineGetter__('length', function(){
    // return this.entities.length;
    return 0;
});

// _.each( ['add', 'remove', 'at', 'each', 'map', 'push', 'where'], function(method){
//     EntitySet.prototype[method] = function(){
//         // log( method + ' ' + JSON.stringify(_.toArray(arguments)) );
//         return this.entities[method].apply( this.entities, arguments );
//     };
// });


exports.create = function(storage, registry, options){
    options = options || {};
    var Model = options.Model || exports.Model;
    var result = new Model(null,{storage:storage, registry:registry});
    return result;
};
