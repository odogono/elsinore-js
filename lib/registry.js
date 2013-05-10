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

        entityDefNameFromSchema: function( schema ){
            var name = _.isString(schema) ? schema : schema.title || schema.id; 
            name = name.split('/').pop();
            return _.classify( name + '_entity_def' );
        },

        entityModelNameFromSchema: function( schema ){
            var name = schema.title || schema.id.split('/').pop();
            return _.classify( name + '_entity' );
        },

        register: function( schema, attrs ){
            return this.registerSchema( schema );
        },

        unregister: function( schema ){

        },

        /**
         * Returns an entity definition from a title or url
         * @param  {[type]} url [description]
         * @return {[type]}     [description]
         */
        get: function(url){
            if( this.defs[url] )
                return this.defs[url];
            var defName = _.classify( url.split('/').pop() + '_entity_def' );
            return odgn.Entity[ defName ];
        },

        create: function( url, attrs ){
            var name = this.entityDefNameFromSchema( url );
            var entityDef = odgn.Entity[name]; //this.defs[ url ];
            return entityDef.create( attrs );
        },


        registerSchema: function( schema ){
            var entityDef = { schema:schema };
            tv4.addSchema( schema.id, schema );

            var defName = this.entityDefNameFromSchema( schema );

            this.defs[ schema.id ] = entityDef;
            odgn.Entity[ defName ] = entityDef;
            
            var entityModel = entityDef.Model = odgn.Entity.Model.extend({

            },{ 
                // assign class properties
                entityDef:entityDef
            });

            entityDef.create = entityDef.Model.create = entityDef.create || function(attrs, options){
                return new entityModel(attrs,options);
            }

            entityDef.parse = entityDef.Model.parse = entityDef.parse || function( resp, options ){
                var result = entityDef.create();
                result.set( result.parse(resp,options) );
                return result;
            }

            return entityDef;
        }
    });



    return {create:create};
};


