/**
*   A collection of stream objects for manipulating entities and components
*/

var Readable = require('stream').Readable;
var Util = require('util');
var Transform = require('stream').Transform;


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
        var self = this;

        var component = this.registry.createComponent( chunk );

        if( !component ){
            this.emit('error creating component');
        } else
            self.push( component );

        return done();

        // return this.registry.createComponent( chunk )
        //     .then( function(component){
        //         self.push(component);
        //         return done();
        //     })
        //     .error(function (e) {
        //         this.emit('error creating component', e );
        //         return done();
        //     });
    }
});



module.exports = {
    JSONComponentParser: JSONComponentParser
}