exports.info = 'default (null) sync';

exports.initialise = function(config, options){
    store = new RedisStorage( config );
    return store;
}

exports.sync = function(method, model, options) {
    // var concluded = false;
    // var resp, modelID;

    // log.debug('called with ' + JSON.stringify(arguments) );
    // function forwardResult( err, result ){
    //     if( err ){
    //         if( options.error )
    //             options.error(err);
    //         else
    //             throw err;
    //         return;
    //     }
    //     if( options.success ){
    //         options.success(result);
    //     }
    // };

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

    // if( !concluded ){
    //     if (resp) {
    //         options.success(resp);
    //     } else {
    //         options.error('Record not found');
    //     }
    // }

    return model;
}