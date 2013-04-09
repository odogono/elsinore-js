require('./common');

var Schema = module.exports = require('./schema');


Schema.toSql = function(schemaUri, options){

    var result = [];
    var s = Schema.env.findSchema(schemaUri);
    var properties = Schema.properties(schemaUri);
    
    console.log( s._attributes )

    var tableName = 'tbl_' + s._attributes.entityId;

    result.push('CREATE TABLE ');
    result.push( tableName );
    result.push('( ');

    for( var key in properties ){
        var property = properties[key];
        result.push( key );
        result.push( ", ");
    }

    result.push(");");
    return result.join("");
}