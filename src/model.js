import _ from 'underscore';
import {Model as BackboneModel} from 'odgn-backbone-model'
import {hash} from './util'



export default class Model extends BackboneModel {
    
    get id(){ return this.attributes.id; }
    set id(id){ this.attributes.id = id; }

    /**
     * Proxies event triggering to the registry
     * @param  {[type]} name [description]
     * @return {[type]}      [description]
     */
    // trigger: function(name){
    //     if( !this.registry ){ return; }
    //     let args = Array.prototype.slice.call(arguments);
    //     args.splice( 1,0, this );
    //     this.registry.trigger.apply( this.registry, args );
    // },

    getRegistry(){
        return this.registry;
    }
    
    setRegistry(registry){
        this.registry = registry;
    }

    isEqual(other){
        return this.hash() === other.hash();
    }

    hash( asString ){
        let result = JSON.stringify( this.cid );//_.omit(this.attributes,'hash'));
        return hash( result, asString );
    }

    toJSON( options ){
        let result = _.clone(this.attributes);
        // remove attributes beginning with '_'
        let copy = {};
        for (let key in result) {
            if(key[0] != '_' ){
                copy[key] = result[key];
            }
        }
        if( this.id ){
            result.id = this.id;
        }
        return copy;
    }
}

Model.prototype.type = 'Model';
Model.prototype.isModel = true;
