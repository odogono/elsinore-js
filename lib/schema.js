
(function(){
    var root = this;
    var Schema;    
    if (typeof exports !== 'undefined') {
        Schema = exports;
    } else {
        root.odgn = root.odgn || {};
        Schema = root.odgn.Schema = {};
    }

    var isServer = (typeof require !== 'undefined');

    // Require Underscore, if we're on the server, and it's not already present.
    var _ = root._;
    if (!_ && isServer) _ = require('underscore');

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

        _.each( schemas, function(schema){
            schema = Schema.getSchema(schema);

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
        if( options.asObject ){
            return properties;
        }

        // convert from property object into an array
        result = _.values( properties );

        // sort the properties by orderPriority
        result = result.sort( propertySort );

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