var Entity = require('./entity');


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
        this.registry = options.registry;
        this.storage = options.storage;

        // the ids of componentDefs that this entityset is interested in
        this._componentDefIds = [];

        this._entityIds = []; // an array of entity ids that maintain the order that they were added
        this._entities = []; // an array of entity ids objs to entity objs
        this._entityComponents = []; // an array of entity ids to component arrays
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
        options = options || {};
        var validate = _.isUndefined( options.validate ) ? true : options.validate;
        if( validate == false && !this.isComponentOfInterest(component) ){
            // log.debug('not interested in ' + component.defId );
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
    },

    _removeComponent: function(component,entity,options){
        var self = this;
        if( !this.isComponentOfInterest(component) ){
            return;
        }

        // remove from entityId -> componentDef
        var components = this._entityComponents[ entity.id ];
        if( components ){
            if( _.size(components) <= 0 ){
                delete this._entities[ entity.id ];
                // search the entity ids for the index to remove
                for( var i=0;i<this._entityIds.length;i++ )
                    if( this._entityIds[i] == entity.id ){
                        this._entityIds.splice(i,1);
                    }
            }
            delete components[ component.defId ]; // = null;
        }

        // self.entities.remove( entity );
        // log.debug('es ' + this.cid + ' component:remove ' + component.defId + ' ' + entity.id );
        var componentsByEntity = this._componentsByType[ component.defId ];
        if( componentsByEntity ){
            delete componentsByEntity[ entity.id ];// = null;
        }
    },

    _destroyEntity: function( entity, options ){

    },


    /**
    *   Reloads entities and associated components from storage
    */
    reload: function(callback){
        var self = this;
        this.storage.retrieveComponents( this.componentDefs, null, function(component){
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
        var entity = Entity.toEntity( entity );
        // log.debug('es.getComponent:' + componentDef.schema.id + ' entity:' + entity.id );
        
        var componentDefsForEntity = this._entityComponents[ entity.id ];
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
        return this._entityComponents[ entityId ] ? entityId : null;
    },

    getEntity: function( index ){
        return this._entities[ this._entityIds[index] ];
    },


    getEntityIds: function(){
        return this._entityIds;
    },

    /**
     * 
     * @param  {[type]} iterator [description]
     * @param  {[type]} context  [description]
     * @return {[type]}          [description]
     */
    forEach: function(iterator, callback){
        var self = this;
        if( !callback ){
            for( var i=0;i<this._entityIds.length;i++ ){
                iterator( this._entities[ this._entityIds[i] ], self );
            }
            // return _.each( this._entities, function(e){
            //     this._entit
            //     return iterator( e, self );
            // });
            return;
        }
        return async.eachSeries( _.values(this._entityIds), function(eId, cb){
            return iterator( this._entities[eId], self, cb );
        }, callback);
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


EntitySet.create = function(attrs, storage, registry, options){
    options = options || {};
    var Model = options.Model || exports.Model;
    var result = new EntitySet(attrs,{storage:storage, registry:registry});
    return result;
};

if( typeof module !== 'undefined' && module.exports ){
    module.exports = { create:EntitySet.create, Model:EntitySet };
}