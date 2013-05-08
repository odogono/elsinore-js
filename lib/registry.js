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
        register: function( schema, attrs ){
            return this.registerSchema( schema );
        },

        unregister: function( schema ){

        },

        create: function( attrs ){

        },


        registerSchema: function( schema ){
            var entityDef = { schema:schema };
            tv4.addSchema( schema.id, schema );

            var className = schema.id.split('/').pop();
            var defName = _.classify( className + '_entity_def' );
            className = _.classify( className + '_entity' );

            odgn.Entity[ defName ] = entityDef;
            // this.defs[ defName ] = entityDef;
            
            var entityModel = entityDef.model = odgn.Entity.Model.extend({});

            entityDef.create = function(attrs, options){
                return new entityModel(attrs,options);
            }
            // print_ins( tv4.resolveUrl(schema.id) );

            // var vr = tv4.validateResult( {
            //     name:'peter', age:32
            // }, schema.id );

            // print_ins( entityClass );
            // print_ins( tv4.context );
            return entityDef;
        }
    });



    return {create:create};
};


