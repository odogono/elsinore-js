var tv4 = require('tv4').tv4;


module.exports = function(odgn){

    var create = function(options){
        var registry = new Registry(options);
        registry.tv4 = tv4;
        return registry;
    };


    var EntityDef = function(){

    };

    _.extend(EntityDef.prototype, {
        
        /**
         * Retrieves properties from the schema
         * @param  {[type]} propertyKeys [description]
         * @return {[type]}              [description]
         */
        retrieveSchemaProperties: function( propertyKeys ){
            if( !propertyKeys )
                return this.schema.properties;
            return _.pick( this.schema.properties, propertyKeys );
        }
    });

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

        /**
         * Returns an Entity Definition from  a string id
         * @param  {[type]} schemaId [description]
         * @return {[type]}          [description]
         */
        entityDefFromId: function( schemaId ){
            if( odgn.Entity[schemaId] )
                return odgn.Entity[schemaId];
            var name = this.entityDefNameFromSchema( schemaId );
            var entityDef = odgn.Entity[name];
            return entityDef;
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

        /**
         * [ description]
         * @param  {[type]} url   [description]
         * @param  {[type]} attrs [description]
         * @return {[type]}       [description]
         */
        create: function( url, attrs, options ){
            var entityDef = this.entityDefFromId( url );
            return entityDef.create( attrs );
        },

        /**
         * Takes a value and attempts to resolve it into
         * the type specified by the schema fragment
         * 
         * @param  {[type]} value  [description]
         * @param  {[type]} schema [description]
         * @return {[type]}        [description]
         */
        resolve: function( data, schema ){
            if( !schema )
                return data;
            if( schema.type ){
                switch( schema.type ){
                    case "string":
                        return data.toString();
                    case "integer":
                        return parseInt(data,10);
                    case "number":
                        return parseFloat(data);
                    case "boolean":
                        switch( data.toLowerCase() ){
                            case "true": case "yes": case "1": return true;
                            case "false": case "no": case "0": case null: return false;
                            default: return Boolean(data);
                        }
                        break;
                    case "object":
                        return JSON.parse(data);
                        break;
                }
            }
            if( schema["$ref"] ){
                return this.parse( data, {schemaId:schema["$ref"]} );
            }
            return data;
        },

        /**
         * [ description]
         * @param  {[type]} resp    [description]
         * @param  {[type]} options [description]
         * @return {[type]}         [description]
         */
        parse: function( resp, options ){
            var self = this;
            options = options || {};
            var schemaId = options.schemaId;

            var parseFn = function(attrs){
                schemaId = attrs.schema_id || schemaId;
                delete attrs.schema_id;
                if( schemaId ){
                    var inst = self.create( schemaId );
                    inst.set( inst.parse( attrs ) );
                    return inst;
                }
                return null;
            };

            if( _.isArray(resp) ){
                return _.map( resp, parseFn );
            }

            return parseFn( resp );
        },

        /**
         * [ description]
         * @param  {[type]} schema [description]
         * @return {[type]}        [description]
         */
        registerSchema: function( schema ){
            tv4.addSchema( schema.id, schema );

            var defName = this.entityDefNameFromSchema( schema );
            var entityDef = new EntityDef();
            entityDef.name = defName;
            entityDef.schema = schema;
            entityDef.registry = this;

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


