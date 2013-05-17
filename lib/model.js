

var Model = module.exports = Backbone.Model.extend({

    // set: function(key, val, options) {
    //     var attr, attrs, unset, changes, silent, changing, prev, current;
    //     if (key == null) return this;

    //     // Handle both `"key", value` and `{key: value}` -style arguments.
    //     if (typeof key === 'object') {
    //         attrs = key;
    //         options = val;
    //     } else {
    //         (attrs = {})[key] = val;
    //     }

    //     options || (options = {});

    //     if( _.keys(attrs).length <= 0 )
    //         return Backbone.Model.prototype.set.apply( this, arguments );

    //     return Backbone.Model.prototype.set.apply( this, arguments );
    // },


    parse: function( resp, options ){
        if( !resp || _.keys(resp).length <= 0 )
            return resp;
        // examine incoming attributes against the schema for any 
        // references to other entity defs
        var entityDef = this.constructor.entityDef;

        // retrieve property descriptions from the schema
        var schemaProperties = entityDef.retrieveSchemaProperties( _.keys(resp) );

        // iterate through the properties
        for( var name in resp ){
            var schemaValue = schemaProperties[name];
            // if their is a mention of this attribute in the schema,
            // then resolve it 
            if( schemaValue ){
                resp[name] = entityDef.registry.resolve( resp[name], schemaValue );
            }
        }

        return resp;   
    }
});