var tv4 = require('tv4').tv4;


module.exports = function(odgn){

    var create = function(options){
        var registry = new Registry(options);
        registry.tv4 = tv4;
        return registry;
    };


    var Registry = function(options){
        this.defs = {};
    };


    _.extend(Registry.prototype, {

        entityDefNameFromUrl: function( url ){
            
        },

        entityModelNameFromUrl: function( url ){

        },

        register: function( schema, attrs ){
            return this.registerSchema( schema );
        },

        unregister: function( schema ){

        },

        get: function(url){

        },

        create: function( url, attrs ){
            var entityDef = this.defs[ url ];
            return entityDef.create( attrs );
        },


        registerSchema: function( schema ){
            var entityDef = { schema:schema };
            var map = tv4.addSchema( schema.id, schema );

            var className = schema.id.split('/').pop();

            var defName = _.classify( className + '_entity_def' );
            className = _.classify( className + '_entity' );
            // log.debug('class name ' + className + ' ' + schema.id );

            this.defs[ schema.id ] = entityDef;
            odgn.Entity[ defName ] = entityDef;
            
            var entityModel = entityDef.model = odgn.Entity.Model.extend({

            },{ 
                // assign class properties
                entityDef:entityDef
            });

            entityDef.create = entityDef.create || function(attrs, options){
                return new entityModel(attrs,options);
            }

            entityDef.parse = entityDef.parse || function( resp, options ){
                var result = entityDef.create();
                result.set( result.parse(resp,options) );
                return result;
            }

            return entityDef;
        }
    });



    return {create:create};
};


