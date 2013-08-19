var Entity = require('./entity');

/**
 * An EntitySet is a container for entities
 *
 * it keeps track of entities which have components it is interested in
 */
var EntitySet = exports.EntitySet = Backbone.Model.extend({
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
        // log.debug('initialising es');// + options.registry );
        this.entities = new Backbone.Collection();
        this.entities.model = Entity;
        this.registry = options.registry;

        this._componentsByType = []; // an array of componentDef ids mapped to arrays of entities

        this.listenTo( this.registry, 'component:add', this._addComponent );
        this.listenTo( this.registry, 'component:remove', this._removeComponent );
        this.listenTo( this.registry, 'entity:destroy', this._destroyEntity );
    },

    _addComponent: function(component, entity, options){
        var self = this;
        if( _.contains(self.componentDefIds, component.defId ) ){
            self.entities.add( entity );    
        }
        log.debug('es ' + this.cid + ' component:add ' + component.defId + ' ' + component.schemaId );
        var componentsByEntity = this._componentsByType[ component.defId ];
        if( !componentsByEntity ){
            log.debug('created componentsByEntity for ' + component.defId);
            this._componentsByType[ component.defId ] = componentsByEntity = [];
        }
        componentsByEntity[ entity.id ] = component;
    },

    _removeComponent: function(component,entity,options){
        var self = this;
        if( _.contains(self.componentDefIds, component.defId ) ){
            self.entities.remove( entity );
        }
        log.debug('es ' + this.cid + ' component:remove ' + component.defId + ' ' + entity.id );
        var componentsByEntity = this._componentsByType[ component.defId ];
        if( componentsByEntity ){
            delete componentsByEntity[ entity.id ];
        }
    },

    _destroyEntity: function( entity, options ){

    },

    setEntities: function(){
        this.entities.set.apply( this.entities, arguments );
        // print_ins( this.entities.at(0) );
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
    getComponent: function( componentDefId, entity, callback ){
        var componentDef = this.registry.getComponentDef( componentDefId );
        var entity = this.registry.toEntity( entity );
        log.debug('es.getComponent:' + componentDef.schema.id + ' entity:' + entity.id );
        var componentsByEntity = this._componentsByType[ componentDef.id ];
        if( componentsByEntity ){
            return componentsByEntity[ entity.id ];
        }
        return null;
    },

});

EntitySet.prototype.__defineGetter__('length', function(){
    return this.entities.length;
});

_.each( ['add', 'remove', 'at', 'each', 'map', 'push', 'where'], function(method){
    EntitySet.prototype[method] = function(){
        // log( method + ' ' + JSON.stringify(_.toArray(arguments)) );
        return this.entities[method].apply( this.entities, arguments );
    };
});


exports.create = function(registry, options){
    var result = new EntitySet(null,{registry:registry});
    return result;
};