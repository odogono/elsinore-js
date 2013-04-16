var Entity = require('./entity');



var super_registerEntityType = Entity._registerEntityType;
Entity._registerEntityType = function(entityDef, options ){
    if( (entityDef = super_registerEntityType.apply( this, arguments ) ) === null )
        return entityDef;


    if( entityDef.schema ){
        log.debug('registering schema ' + entityDef.schema.id );
        
        Entity.schema.register( entityDef.schema );
        entityDef._schema = Entity.schema.env.findSchema(entityDef.schema.id);
    }

}

_.extend( Entity.Entity.prototype, {
    schemaProperties: function(){
        // return 
    }
});

// console.log(entity);
// process.exit();