var Entity = require('./entity');
var _ = require('underscore');
var Backbone = require('backbone');
// var BitArray = require('bit-array');
var BitField = require('./bit_field');
var ComponentDef = require('./component_def');
var Utils = require('./utils');

/**
 * An EntitySet is a container for entities
 *
 * it keeps track of entities which have components it is interested in
 *
 *  exclude - if an entity has a given component, the entity will not be added
            this overrides everything else
 *  include - if it doesn't have all of the components, it will not be included
 *  optional - if it has some of the components it will be included
 *
 */
var EntitySet = Backbone.Model.extend({
    defaults:{
        start: 0, // the starting index
        page: 1, // the current page index
        page_size: 10, // the number of items in each page
        entity_count: 0, // the total number of entities
        page_count: 0, // the number of 'pages'
    },

    initialize: function( attrs, options ){
        var self = this;
        options || (options = {});
        this.registry = options.registry;
        this.storage = options.storage;
        this._reset( true );
    },

    _reset: function( initialize ){
        if( initialize ){
            // the ids of componentDefs that this entityset is interested in
            this._includedComponents = BitField.create();
            this._excludedComponents = BitField.create();
            this._optionalComponents = BitField.create();
        }

        this._entityIds = []; // an array of entity ids that maintain the order that they were added
        this.entities = []; // an array of entity objects that maintain the order that they were added
        this._entityObjs = {}; // an array of entity ids objs to entity objs
        this._entityComponents = {}; // an array of entity ids to component arrays
        this._componentsByType = {}; // an array of componentDef ids mapped to arrays of entities
    },

    destroy: function(){
        this.stopListening();
        this._componentsByType = null;
        this._entityComponents = null;
        this._entityObjs = null;
        this._entityIds = null;
        this.entities = null;
        this._includedComponents = null;
        this._excludedComponents = null;
        this._optionalComponents = null;
        this.storage = null;
        this.registry = null;
    },


    // at: function(index) {
    //     var entityId = this._entityIds[index];
    //     return entityId ? this._entityObjs[ entityId ] : null;
    // },

    at: function(index) {
      return this.entities[index];
    },

    setComponentMask: function( mask, componentDefs, options ){
        var componentDefId;
        options || (options || {});
        componentDefs = _.isArray(componentDefs) ? componentDefs : [ componentDefs ];
        var bitField = null;
        // log.debug('mask is ' + mask + ' ' + EntitySet.INCLUDE );
        switch( mask ){
            case EntitySet.INCLUDE: bitField = this._includedComponents; break;
            case EntitySet.EXCLUDE: bitField = this._excludedComponents; break;
            case EntitySet.OPTIONAL: bitField = this._optionalComponents; break;
        }

        for( var i=0;i<componentDefs.length;i++ ){
            componentDefId = ComponentDef.getId( componentDefs[i] );
            bitField.set(  componentDefId, true );
        }
        return this;
    },

    // setIncludedComponents: function( componentDefs, options ){
    //     var componentDefId;
    //     options || (options || {});
    //     componentDefs = _.isArray(componentDefs) ? componentDefs : [ componentDefs ];

    //     for( var i=0;i<componentDefs.length;i++ ){
    //         componentDefId = ComponentDef.getId( componentDefs[i] );
    //         this._includedComponents.set(  componentDefId, true );
    //     }
    //     return this;
    // },

    // setOptionalComponents: function( componentDefs, options ){
    //     var componentDefId;
    //     options || (options || {});
    //     componentDefs = _.isArray(componentDefs) ? componentDefs : [ componentDefs ];

    //     for( var i=0;i<componentDefs.length;i++ ){
    //         componentDefId = ComponentDef.getId( componentDefs[i] );
    //         this._optionalComponents.set(  componentDefId, true );
    //     }
    //     return this;
    // },

    // setExcludedComponents: function( componentDefs, options ){
    //     var componentDefId;
    //     options || (options || {});
    //     componentDefs = _.isArray(componentDefs) ? componentDefs : [ componentDefs ];

    //     for( var i=0;i<componentDefs.length;i++ ){
    //         componentDefId = ComponentDef.getId( componentDefs[i] );
    //         this._excludedComponents.set(  componentDefId, true );
    //     }        
    //     return this;
    // },


    /**
    *   Returns true if the given entity is of interest
    *   All of its components must be allowed by the set
    */
    isEntityOfInterest: function( entity ){
        var excludedCount = this._excludedComponents.count();
        var includedCount = this._includedComponents.count();
        var optionalCount = this._optionalComponents.count();

        if( excludedCount == 0 && includedCount == 0 && optionalCount == 0 )
            return true;

        var bf = entity.getComponentBitfield();

        // check for matches against excluded
        // log.debug('iEoI ' + entity.id + ' ' + bf.toHexString() + ' ' + this._includedComponents.toHexString() + ' ' + this._includedComponents.and( null, bf ) );

        if( this._excludedComponents.and( null, bf ) !== 0 ){
            return false;
        }

        if( includedCount == 0 && optionalCount == 0 )
            return true;

        if( this._optionalComponents.or( null, bf, this._optionalComponents ) ){
            return true;
        }

        if( this._includedComponents.and( null, bf, this._includedComponents ) ){
            return true;
        }

        return false;
    },

    /**
     * Returns true if the given componentDef is of interest
     * to this entityset
     * 
     * @param  {[type]} componentDef [description]
     * @return {[type]}              [description]
     */
    isComponentOfInterest: function( componentDef ){
        var componentDefId = ComponentDef.getId( componentDef );
        var excludedCount = this._excludedComponents.count();
        var includedCount = this._includedComponents.count();
        var optionalCount = this._optionalComponents.count();

        // log.debug('include ' + includedCount + ' exclude ' + excludedCount + ' optional ' + optionalCount);

        if( excludedCount == 0 && includedCount == 0 && optionalCount == 0 )
            return true;
        
        if( excludedCount > 0 && this._excludedComponents.get( componentDefId ) ){
            // log.debug('iCoI NOK ' + componentDefId );
            return false;
        }

        if( includedCount == 0 && optionalCount == 0 ){
            // log.debug('iCoI OK ' + componentDefId );
            return true;
        }

        var include = this._includedComponents.get( componentDefId );
        var optional = this._optionalComponents.get( componentDefId );
        
        if( (include || optional) ){
            // log.debug('iCoI OK ' + componentDefId );
            return true;
        }
        return false;
    },


    addComponent: function(component, options){
        var self = this, silent, entityId, entity, componentDef, componentArray;
        var ignoreComponentOptions = { ignoreComponents:true };
        options || (options = {});
        silent = options.silent;
        entity = options.entity;

        if( _.isArray(component) ){
            return _.each( component, function(com){
                return self.addComponent( com, options );
            })
        }

        if( !component.getEntityId() )
            throw new Error('no entity id for component');

        componentDef = component.getComponentDef();

        // check whether we are intersted in adding this component
        if( !this.isComponentOfInterest( componentDef ) ){
            return this;
        }

        if( !entity ){
            entity = this.addEntity( component.getEntityId(), ignoreComponentOptions );
        }

        // log.debug('adding com ' + JSON.stringify(component) + ' to ' + component.getEntityId() );

        // make a note of the component on the entity
        entity.addComponent( component );

        // this.listenTo( component, 'change', function(){
        //     var args = _.toArray(arguments);
        //     args.unshift( 'change:component' );
        //     self.trigger.apply( self, args );
        // });

        // set the componentDef onto the Entity, so we have a quick way of seeing what we have

        // add to list of all components
        componentArray = this._componentsByType[ componentDef.id ] || [];
        this._componentsByType[ componentDef.id ] = componentArray;

        if( !silent ){
            this.trigger('add:component', component, componentDef.id, entity.id );
        }

        return this;
    },



    /**
    *
    */
    removeComponent: function( component, options ){
        options || (options = {});
        var ignoreEntity = options.entity;

        var entity = this.getEntity( component.getEntityId() );
        var silent = options.silent;

        if( !ignoreEntity && !entity ){

            // the entity doesn't belong
            return;
        }

        if( !ignoreEntity && !entity.hasComponent( component ) ) {
            return;
        }

        if( ignoreEntity )
            ignoreEntity.removeComponent( component );
        else
            entity.removeComponent( component );

        this.stopListening( component );

        if( !silent ) this.trigger('component:remove', component );
        
        if( !ignoreEntity && !entity.hasComponents() ){
            this.removeEntity( entity );
        }
        
        return this;
    },

    /**
    *
    */
    addEntity: function( entity, options){
        var self = this, entityId, existingEntity, silent, ignoreComponents;
        var addComponentOptions;

        if( _.isArray(entity) ){
            return _.each( entity, function(e){
                return self.addEntity(e,options);
            })
        }
        
        options || (options = {});
        silent = options.silent;
        ignoreComponents = options.ignoreComponents;

        entity = Entity.toEntity( entity );
        entityId = entity.id;
        existingEntity = this._entityObjs[ entityId ];

        // entities without components should not be added
        if( !ignoreComponents && entity.components.length <= 0 ){
            return null;
        }

        if( !ignoreComponents && !this.isEntityOfInterest( entity ) ){
            return null;
        }

        if( existingEntity )
            return existingEntity;

        existingEntity = Entity.toEntity( entityId );

        if( !ignoreComponents && entity.components.length > 0 ){
            addComponentOptions = { entity: existingEntity, checkComponents:false };
            _.each( entity.components, function(com){
                self.addComponent( com, addComponentOptions );
            });

            // recheck to see if any valid components were added
            if( existingEntity.components.length <= 0 ){
                return null;
            }
        }

        this._entityIds.push( entityId );
        this.entities.push( existingEntity );

        // add to map of entityId to entity instance
        this._entityObjs[ entityId ] = existingEntity;

        if( !silent ){
            this.trigger('add:entity', entityId );
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
        var self = this, entityId, existingEntity, silent, index, removeComponentOptions;

        options || (options = {});
        silent = options.silent;
        entity = Entity.toEntity( entity );
        entityId = entity.id;
        existingEntity = this._entityObjs[ entityId ];

        if( !existingEntity ){
            return null;
        }

        // remove the entity from the set
        delete this._entityObjs[ entityId ];

        index = _.indexOf( this._entityIds, entityId );
        if( index > -1 ){
            this._entityIds.splice( index, 1 );
            this.entities.splice( index, 1 );
        }

        removeComponentOptions = { entity: existingEntity };

        _.each( existingEntity.components, function(com){
            self.removeComponent( com, removeComponentOptions );
        });

        if( !silent ){
            this.trigger('remove:entity', entityId );
        }

        return existingEntity;
    },

    getEntity: function( entity, options ){
        var entityId, entity, existingEntity;
        entityId = Utils.isInteger( entity ) ? entity : entity.id;
        existingEntity = this._entityObjs[ entityId ];

        return existingEntity;
    },

    /**
    *
    */
    reset: function(entities, options){
        var self = this, i,len,entity, removeComponentOptions;
        options || (options = {});
        removeComponentOptions = { silent: true };

        for( i=0,len=this.entities.length; i<len; i++ ){
            entity = this.entities[i];;
            removeComponentOptions.entity = entity;

            _.each( entity.components, function(com){
                self.removeComponent( com, removeComponentOptions );
            });
        }

        this._reset();
        
        if( entities ){
            this.addEntity( entities, _.extend({silent: true}, options) );
        }

        if (!options.silent) {
            this.trigger('reset', this, options);
        }
    },

},{
    INCLUDE: 0,
    OPTIONAL: 1,
    EXCLUDE: 2
});


EntitySet.prototype.__defineGetter__('length', function(){
    return this.entities.length;
});

_.each( ['forEach', 'each', 'map', 'where', 'filter'], function(method){
    EntitySet.prototype[method] = function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift( this.entities );
        // console.log( method + ' ' + JSON.stringify(_.toArray(args)) );
        // return this.entities[method].apply( this.entities, arguments );
        return _[method].apply( _, args );
    };
});


EntitySet.create = function(attrs, storage, registry, options){
    options = options || {};
    var Model = options.Model || exports.Model;
    var result = new EntitySet(attrs,{storage:storage, registry:registry});
    return result;
};


module.exports = EntitySet;