/**
*   A collection of stream objects for manipulating entities and components
*/

var Readable = require('stream').Readable;
var Util = require('util');
var Transform = require('stream').Transform;

// Util.inherits(SimpleProtocol, Readable);
// function ComponentParser(source, options){
//     if (!(this instanceof ComponentParser))
//         return new ComponentParser(source, options);
//     Readable.call(this, options);
// }



Util.inherits(JSONComponentParser, Transform);
function JSONComponentParser(registry, options){
    if (!(this instanceof JSONComponentParser))
        return new JSONComponentParser(registry,options);
    options || (options = {});
    // options.decodeStrings = false;
    this.registry = registry;
    options.objectMode = true;
    Transform.call(this, options);
}

_.extend(JSONComponentParser.prototype, {
    _transform: function(chunk, encoding, done) {
        this.registry.createEntity( chunk );
        // log.debug('transforming ' + JSON.stringify(chunk) );
        this.push(chunk);
        return done();
    }
});



module.exports = {
    JSONComponentParser: JSONComponentParser
}