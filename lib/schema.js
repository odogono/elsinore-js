
(function(){
    var root = this;
    var Schema;    
    var isServer = (typeof exports !== 'undefined');

    if (isServer) {
        Schema = exports;
    } else {
        root.odgn = root.odgn || { entity:{} };
        Schema = root.odgn.entity.Schema = {};
    }

    // require tv4, if we're on the server, and it's not already present
    var tv4 = (!tv4 && isServer) ? require('tv4').tv4 : tv4;
    Schema.tv4 = tv4;

    // a map of schema urls to schema objects
    var schemas = {};

    /**
     * Adds a new schema
     * 
     * @param  {[type]} url    [description]
     * @param  {[type]} schema [description]
     * @return {[type]}        [description]
     */
    Schema.addSchema = function( url, schema ){
        if( _.isObject(url) ){
            schema = url;
            url = schema.id;
        }
        var result = tv4.addSchema( url, schema );
        return url;
    };

    Schema.getSchema = function( url ){
        if( !url ){
            return null;
        }
        if( _.isString(url) )
            return tv4.getSchema(url);
        if( url.schema ){
            return tv4.getSchema(url.schema);
        }
        if( !url.id ){
            return url;
        }
        return tv4.getSchema(url.id);
    };


    /**
     * Determines the sort order of two properties
     * 
     * @param  {[type]} a [description]
     * @param  {[type]} b [description]
     * @return {[type]}   [description]
     */
    var propertySort = function(a,b){
        // var ap = a.orderPriority === undefined ? 0 : a.orderPriority;
        // var bp = b.orderPriority === undefined ? 0 : b.orderPriority;
        var ap = a.orderPriority || 0;
        var bp = b.orderPriority || 0;
        if( ap < bp ){ return 1; }
        if( ap > bp ){ return -1; }
        return 0;
    }

    /**
     * Returns an array of properties for the specified
     * schema
     * 
     * @param  {[type]} schema [description]
     * @return {[type]}        [description]
     */
    Schema.getProperties = function( schemas, options ){
        options = options || {};
        // if a single val was passed, then convert
        if( !_.isArray(schemas) ){ schemas = [schemas] };
        var properties = {}, result,prop;

        _.each( schemas, function(schemaUri){
            schema = Schema.getSchema(schemaUri);
            if( !schema ){
                log.warn('no schema found for ' + schemaUri);
                return;
            }

            // convert from property object into an array
            for( var key in schema.properties ){
                prop = schema.properties[key];
                properties[key] = _.extend({name:key}, prop);
            }

            // process the allOf property if it exists - combine
            // the properties of referenced schemas into the result
            if( _.isArray(schema.allOf) ){
                var props = Schema.getProperties( 
                    _.pluck( schema.allOf, '$ref' ), 
                    _.extend({asObject:true},options) );
                properties = _.extend( props, properties );
            }        
        });

        // return properties as {name:prop} if requested
        // of course it doesn't make sense to sort if we are
        // returning an object...
        if( options.asObject ){
            return properties;
        }

        if( schema.propertyPriorities ){
            // apply priorities to our keys
            for( var key in schema.propertyPriorities ){
                if( properties[key] ){
                    properties[key].orderPriority = schema.propertyPriorities[key];
                }
            }

            // convert from property object into an array
            result = _.values( properties );

            // sort the properties by orderPriority
            result = result.sort( propertySort );    
        } else {
            // convert from property object into an array
            result = _.values( properties );
        }
        
        return result;
    };

    Schema.getDefaultValues = function (schemas, options){
        var properties = Schema.getProperties( schemas, options );
        var result = {};
        _.each( properties, function(prop){
            result[prop.name] = _.isUndefined(prop['default']) ? null : prop['default'];
        });
        return result;
    };

    /**
     * [ description]
     * @param  {[type]} schema [description]
     * @return {[type]}        [description]
     */
    Schema.titleFromSchema = function(schema){
        schema = Schema.getSchema(schema);
        if( schema.title )
            return schema.title;

        // log.debug( 'splitting ' + JSON.stringify(schema) ); // process.exit();
        var title = schema.id.split('/').pop();
        return title;
    };


}).call(this);