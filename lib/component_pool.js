var Backbone = require('backbone');
var Component = require('./component');
var ComponentDef = require('./component_def');

var ComponentPool = Backbone.Model.extend({
});


var create = function(registry, componentDef, poolSize, options){
    var pool = new ComponentPool();
    return pool;
}


module.exports = ComponentPool;