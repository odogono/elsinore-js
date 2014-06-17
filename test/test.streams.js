var Common = require('./common');
var Gulp = require('gulp');
var Path = require('path');
var JSONStream = require('JSONStream');
var Es = require('event-stream');
var Fs = require('fs');
var Util = require('util');
var Transform = require('stream').Transform;

var Registry = Elsinore.Registry;
var MemoryStorage = Elsinore.storage.MemoryStorage;
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;


Util.inherits(TestTransform, Transform);
function TestTransform(options){
    if (!(this instanceof TestTransform))
        return new TestTransform(options);
    options || (options = {});
    // options.decodeStrings = false;
    options.objectMode = true;
    Transform.call(this, options);
}

_.extend(TestTransform.prototype, {
    _transform: function(chunk, encoding, done) {
        log.debug('transforming ' + JSON.stringify(chunk) );
        this.push(chunk);
        return done();
    }
});

describe('Streams', function(){

    beforeEach(function(){
        var self = this;
        var components = Common.readFixture('components.json', true);
        return Registry.create().initialize().then( function(registry){
            self.registry = registry;
            return registry.registerComponent( components );
        });
    });

    it('should stream', function(){
        var filename = Path.join(__dirname, "./fixtures/entities.json");
        var test = new TestTransform();
        // log.debug( filename );
        Fs.createReadStream( filename, { encoding: 'utf-8' })
            // .pipe(Es.mapSync(function(data){
            //     log.debug('what? ' + data);
            //     return data; 
            // }))
            .pipe(JSONStream.parse('*'))
            // .pipe(Es.mapSync(function (data) {
            //     console.error('? ' + data._s )
            //     return data
            // }))
            .pipe(Es.through(
                null,
                // function write(data) {
                //     console.error('? ' + JSON.stringify(data) )
                //     return this.emit('data', data);
                // }, 
                function end(){
                    log.debug('all finished');
                }))
            .pipe( test )
    });

    it('should load components into the registry by piping them');

    it('should serialise entities into a JSON stream by piping them through a thingy');

    it('should load entities into an entityset by piping them in');


});