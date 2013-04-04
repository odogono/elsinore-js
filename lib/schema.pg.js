require('./common');

var schema = module.exports = require('./schema');


schema.toSql = function(schemaUri, options){
    return "sql";
}