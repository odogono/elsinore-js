exports.info = 'default (null) sync';

var DefaultStorage = function(){
};

exports.initialise = function(config, options){
    var store = new DefaultStorage();
    return store;
}

exports.sync = function(method, model, options) {
    options = options || {};
    if( options.debug )  log.debug('sync with ' + method );
    switch( method ){
        case 'read':
            options.error( 'default sync active' );
            break;
        case 'create':
            options.error( 'default sync active' );
            break;
        case 'update':
            options.error( 'default sync active' );
            break;
        case 'delete':
            options.error( 'default sync active' );
            break;
    }
    return model;
}