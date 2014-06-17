var Entity = require('./entity');
var _ = require('underscore');
var Backbone = require('backbone');
// var BitArray = require('bit-array');
var BitField = require('./bit_field');
var ComponentDef = require('./component_def');
var Component = require('./component');
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
            this._componentMasks = [ BitField.create(), BitField.create(), BitField.create()];
        }

        this._entityIds = []; // an array of entity ids that maintain the order that they were added
        this.entities = []; // an array of entity objects that maintain the order that they were added
        this._entityObjs = {}; // an array of entity ids objs to entity objs
        this._entityComponents = {}; // an array of entity ids to component arrays
        this._componentsByType = {}; // an array of componentDef ids mapped to arrays of entities
        this._componentsById = []; // an array of component ids to component instances
    },

    destroy: function(){
        this.stopListening();
        this._componentsByType = null;
        this._componentsById = null;
        this._entityComponents = null;
        this._entityObjs = null;
        this._entityIds = null;
        this.entities = null;
        this._componentMasks = null;
        this.storage = null;
        this.registry = null;
    },

    at: function(index) {
        return this.entities[index];
    },

    setComponentMask: function( mask, componentDefs, options ){
        var componentDefId, i,l;
        options || (options || {});
        componentDefs = _.isArray(componentDefs) ? componentDefs : [ componentDefs ];
        var bitField = this._componentMasks[ mask ];
        // log.debug('mask is ' + mask + ' ' + EntitySet.INCLUDE );
        // switch( mask ){
        //     case EntitySet.INCLUDE: bitField = this._includedComponents; break;
        //     case EntitySet.EXCLUDE: bitField = this._excludedComponents; break;
        //     case EntitySet.OPTIONAL: bitField = this._optionalComponents; break;
        // }

        for( i=0,l=componentDefs.length;i<l;i++ ){
            componentDefId = ComponentDef.getId( componentDefs[i] );
            bitField.set(  componentDefId, true );
        }
        return this;
    },

    toString: function(){
        var inc = this._componentMasks[ EntitySet.INCLUDE ].toString();
        var exc = this._componentMasks[ EntitySet.EXCLUDE ].toString();
        var opt = this._componentMasks[ EntitySet.OPTIONAL ].toString();

        return 'inc:' + inc + ' exc:' + exc + ' opt:' + opt;
    },

    /**
    *   Returns true if the given entity is of interest
    *   All of its components must be allowed by the set
    */
    isEntityOfInterest: function( entity ){
        var inc = this._componentMasks[ EntitySet.INCLUDE ];
        var exc = this._componentMasks[ EntitySet.EXCLUDE ];
        var opt = this._componentMasks[ EntitySet.OPTIONAL ];

        var excludedCount = exc.count();
        var includedCount = inc.count();
        var optionalCount = opt.count();

        if( excludedCount == 0 && includedCount == 0 && optionalCount == 0 )
            return true;

        var bf = entity.getComponentBitfield();

        // check for matches against excluded
        // log.debug('iEoI ' + entity.id + ' ' + bf.toString() + ' !' + exc.toString() + '! ' + exc.and( null, bf ) );

        if( excludedCount > 0 && exc.and( null, bf ) ){
            return false;
        }

        if( includedCount == 0 && optionalCount == 0 )
            return true;

        // if any of the components match optional, then true
        if( opt.and( null, bf ) ){
            return true;
        }

        // if all of the components match include, then true
        if( inc.and( null, bf, inc ) ){
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
        var inc = this._componentMasks[ EntitySet.INCLUDE ];
        var exc = this._componentMasks[ EntitySet.EXCLUDE ];
        var opt = this._componentMasks[ EntitySet.OPTIONAL ];

        var excludedCount = exc.count();
        var includedCount = inc.count();
        var optionalCount = opt.count();

        // log.debug('include ' + includedCount + ' exclude ' + excludedCount + ' optional ' + optionalCount);

        if( excludedCount == 0 && includedCount == 0 && optionalCount == 0 )
            return true;
        
        if( excludedCount > 0 && exc.get( componentDefId ) ){
            return false;
        }

        if( includedCount == 0 && optionalCount == 0 ){
            return true;
        }

        var include = inc.get( componentDefId );
        var optional = opt.get( componentDefId );
        
        if( (include || optional) ){
            return true;
        }
        return false;
    },


    addComponent: function(component, options){
        var self = this, silent, listenTo, entityId, entity, componentDef, componentArray, existingCom;
        var ignoreComponentOptions = { ignoreComponents:true };
        options || (options = {});
        silent = options.silent;
        entity = options.entity;
        listenTo = options.listen;

        if( _.isArray(component) ){
            return _.each( component, function(com){
                return self.addComponent( com, options );
            })
        }

        if( !component.getEntityId() )
            throw new Error('no entity id for component');

        componentDef = Component.getComponentDef( component );

        // check whether we are intersted in adding this component
        if( !this.isComponentOfInterest( componentDef ) ){
            // log.debug( componentDef.getName() +  ' not of interest');
            return this;
        }

        // log.debug( componentDef.getName() +  ' of interest');

        if( !entity ){
            entity = this.addEntity( component.getEntityId(), ignoreComponentOptions );
        }

        // try and retrieve the existing component
        existingCom = entity.getComponent( component );

        if( existingCom ){
            // log.debug('updating com ' + component.cid + ' ' + JSON.stringify(component) + ' on ' + component.getEntityId() + ' ' + existingCom.cid + ' ' + JSON.stringify(existingCom));
            existingCom.set( component.attributes );
            if( existingCom.hasChanged() ){
                this.trigger('component:change', existingCom, ComponentDef.getId( existingCom ), entity.id );
            }
            // print_ins( existingCom );
            return this;
        }

        // log.debug('adding com ' + component.cid + ' ' + JSON.stringify(component) + ' to ' + component.getEntityId() );

        // make a note of the component on the entity
        entity.addComponent( component );

        if( listenTo ){
            this.listenTo( component, 'change', function(){
                var args = _.toArray(arguments);
                args.unshift( 'component:change' );
                self.trigger.apply( self, args );
            });
        }

        // set the componentDef onto the Entity, so we have a quick way of seeing what we have

        // add to list of all components
        componentArray = this._componentsByType[ componentDef.id ] || [];
        componentArray.push( component );
        this._componentsByType[ componentDef.id ] = componentArray;
        
        this._componentsById[ component.id ] = component;

        if( !silent ){
            this.trigger('component:add', component, componentDef.id, entity.id );
        }

        return this;
    },


    getComponentById: function( id ){
        return this._componentsById[ id ];
    },

    getComponents: function(){
        return _.compact( this._componentsById );
    },

    getComponentsByComponentDef: function( def ){
        return this._componentsByType[ def.id ];
    },


    removeComponentsByComponentDef: function( def, options ){
        var i,len,components = this._componentsByType[ def.id ];
        for( i=0,len=components.length;i<len;i++ ){
            this.removeComponent( components[i], options );
        }
    },

    /**
    *
    */
    removeComponent: function( component, options ){
        options || (options = {});
        var componentArray;
        var ignoreEntity = options.entity;

        var entity = this.getEntity( component.getEntityId() );
        var silent = options.silent;
        var componentDef = Component.getComponentDef( component );

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

        delete this._componentsById[ component.id ];

        componentArray = this._componentsByType[ componentDef.id ];
        componentArray = _.filter( componentArray, function(com){
            return com.id != component.id;
        });
        this._componentsByType[ componentDef.id ] = componentArray;

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
            this.trigger('entity:add', entityId );
        }

        return existingEntity;
    },

    /**
    *
    */
    hasEntity: function( entity ){
        return getEntity( entity ) != null;
    },

    hasEntityId: function( entityId ){
        return this._entityObjs[ entityId ] != null;
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
            this.trigger('entity:remove', entityId );
        }

        return existingEntity;
    },

    getEntity: function( entity, options ){
        var entityId, entity, existingEntity;
        entityId = Utils.isInteger( entity ) ? entity : entity.id;
        existingEntity = this._entityObjs[ entityId ];

        return existingEntity;
    },

    getComponentEntity: function( component, options ){
        var result;
        var com = this.getComponentById( component.id );
        if( !com )
            throw new Error('no component found with id ' + component.id );
        var entityId = com.getEntityId();
        if( !entityId )
            throw new Error('no entity id for component');
        result = this._entityObjs[ entityId ];
        return result;
    },

    /**
    *
    */
    reset: function(entities, options){
        var self = this, i,len,entity, removeComponentOptions;
        options || (options = {});
        removeComponentOptions = { silent: true };

        for( i=0,len=this.entities.length; i<len; i++ ){
            entity = this.entities[i];
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


EntitySet.create = function(options){
    options || (options = {});
    // var Model = options.Model || exports.Model;
    var result = new EntitySet();
    if( options.include )
        result.setComponentMask( EntitySet.INCLUDE, options.include );
    if( options.optional )
        result.setComponentMask( EntitySet.OPTIONAL, options.optional );
    if( options.exclude )
        result.setComponentMask( EntitySet.EXCLUDE, options.exclude );
    return result;
};


module.exports = EntitySet;