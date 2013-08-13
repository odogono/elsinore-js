var Entity = require('./entity');

/**
 * An EntitySet is a container for entities
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
        log.debug('initialising es');// + options.registry );
        this.entities = new Backbone.Collection();
        this.entities.model = Entity;
        this.registry = options.registry;
        this.listenTo( this.registry, 'component:add', function(component,entity,options){
            if( _.contains(self.componentDefIds, component.defId ) ){
                self.entities.add( entity );    
            }
        });
        this.listenTo( this.registry, 'component:remove', function(component,entity,options){
            if( _.contains(self.componentDefIds, component.defId ) ){
                self.entities.remove( entity );
            }
        })
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
    }

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