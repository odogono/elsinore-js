exports.info = 'default (null) sync';


var EntitySync = exports.EntitySync = function(options){
    log.debug('EntitySync created ');// + this.sync );
    _.bindAll( this, 'sync' );
};

_.extend( EntitySync.prototype, {

    constructor: function(){
        log.debug('EntitySync constructor');
    },

    sync: function(method, model, options) {
        options = options || {};

        // a callback conversion function used because
        // backbone doesn't use (err,result) style
        var forwardResult = function( err, result ){
            if( err ){
                if( options.error ){
                    return options.error(err);
                }else{
                    throw err;
                }
            }
            else if( options.success ){
                return options.success(result);
            }
        };

        if( options.debug )  log.debug('sync with ' + method );

        switch( method ){
            case 'read':
                this.read( model, options, forwardResult );
                break;
            case 'create':
                this.create( model, options, forwardResult );
                break;
            case 'update':
                this.update( model, options, forwardResult );
                break;
            case 'delete':
                this.delete( model, options, forwardResult );
                break;
        }
        return model;
    },


    create: function( model, options, callback ){
        callback();
    },
    read: function( model, options, callback ){
        callback();
    },
    update: function( model, options, callback ){
        callback();
    },
    delete: function( model, options, callback ){
        callback();
    },

});

EntitySync.extend = Backbone.Model.extend;

exports.create = function(options){
    options = options || {};
    var result = new EntitySync(options);
    return result;
};