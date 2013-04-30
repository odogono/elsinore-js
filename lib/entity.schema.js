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

    return entityDef;
}

_.extend( Entity.Entity.prototype, {

    getSchema:function(){
        return Entity.ids[this.type]._schema;// || Entity.schema.env.findSchema();
    },

    storeKeys: function(){
        var properties = Entity.schema.properties( this.getSchema() );
        if( !properties )
            return null;
        var result = [];
        for( var propName in properties ){
            var propDetails = properties[propName];
            if( !propDetails._value.set_index ){
                // result[propName] = propDetails._value.enum
                result.push( propName );
            }
        }
        return result;
        // return [ {key:'status', isUnique:true} ];
    },

    getSetIndexes: function(){
        var properties = Entity.schema.properties( this.getSchema() );
        if( !properties )
            return null;
        var result = {};
        // console.log( properties );
        for( var propName in properties ){
            var propDetails = properties[propName];
            if( propDetails._value.set_index ){
                result[propName] = propDetails._value.enum
            }
        }
        return result;
    },

    schemaProperties: function(){
        // return 
    }
});

// console.log(entity);
// process.exit();