var JsonSchema = require('./schema');


/**
 * Components contain data
 * @type {[type]}
 */
var Component = exports.Component = Backbone.Model.extend({
    parse: function( resp, options ){
        if( !resp || _.keys(resp).length <= 0 )
            return resp;

        return resp;
    }
});


exports.create = function(options){
    var com = new Component();
    return com;
}


exports.isComponentDef = function( obj ){
    if( typeof obj === 'object' && obj.schema && obj.create ){
        return true;
    }
    return false;
}