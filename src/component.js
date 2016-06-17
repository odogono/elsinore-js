import _ from 'underscore';
import Backbone from 'backbone';
import Model from './model';
import * as Utils from './util';

/**
 * Components contain data
 * @type {[type]}
 */
const Component = Model.extend({
    type: 'Component',
    isComponent: true,

    parse: function( resp ){
        // console.log('Component.parse', resp);
        var esId = 0, eId = 0;
        if( !resp || _.keys(resp).length <= 0 ){
            return resp;
        }
        if( resp['@es'] ){
            esId = resp['@es'];
            delete resp['@es'];
        }
        if( resp['@e'] ){
            eId = resp['@e'];
            // delete resp['@e'];
        }
        if( esId || eId ){
            // log.debug('creating from ' + eId + ' ' + esId );
            resp['@e'] = Utils.setEntityIdFromId(eId, esId);
        }

        return resp;
    },

    // toJSON: function(){
    //     var result = Model.prototype.toJSON.apply(this); //_.clone(this.attributes);
    //     result.n = this.name;
    //     result._cid = this.cid;
    //     return result;
    // },
    
    getEntityId: function(){
        return this.get('@e');
    },

    setEntityId: function(id, internalId){
        this.set({'@e':id}, {silent:true});
    },

    getDefId: function(){
        return this.get('@s');
    },
    // setDefId: function(id){
    //     this.set({'@s':id});
    // },
    // getSchemaId: function(){
    //     return this.get('@s');
    // },
    // setSchemaId: function(id){
    //     this.set({'@s':id});
    // },

    setId: function(id){
        this.set({'@c':id}, {silent:true});  
    },

    getId: function(id){
        return this.get('@c');
    },

    // getSchemaUri: function(){
    //     return this._defUri;
    // },
    // setDefUri: function(uri:string){
    //     this._defUri = uri;
    // },
    getDefUri: function(){
        return this._defUri;
    },
    // setDefHash: function(hash:string){
    //     this._defHash = hash;
    // },
    getDefHash: function(){
        return this._defHash;
    },
    getDefName: function(){
        return this._defName;
    },
    // setDefName: function(name:string){
    //     this.name = this._defName = name;
    // },
    setDefDetails: function( id, uri:string, hash:string, name:string ){
        this.set({'@s':id});
        this._defUri = uri;
        this._defHash = hash;
        this.name = this._defName = name;  
    },
    // getSchemaHash: function(){
    //     return this._defHash;
    // },

    hash: function(asString){
        let result = Utils.stringify(  _.omit(this.attributes, '@e','@es','@s', '@c') );
        return Utils.hash( result, asString );
    },
});


Component.create = function( attrs, options){
    var com;
    com = new Component( attrs, options );
    return com;
};



Component.isComponent = function(obj){
    return obj && obj.isComponent;
};


export default Component;