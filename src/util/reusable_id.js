import _ from 'underscore';
import PromiseQ from 'promise-queue';

export default class ReusableId {

    constructor( defaultValue ){
        this.defaultValue = _.isUndefined(defaultValue) ? 1 : defaultValue;
        this.availableIds = [];
        this.promiseQ = new PromiseQ(1);
        this.currentId = this.defaultValue;
    }


    /**
     * 
     */
    get(){
        return pq.add( () => {
            return this.nextFree()
                .then( val => {
                    if( val ){ return val;}

                    // increment a new id
                    const result = this.currentId;
                    this.currentId = this.currentId + 1;
                    return result;
                })
        })
    }

    /**
     * Returns <count> new ids
     */
    getMultiple(count){
        return Promise.all( _.times(count, c => this.get()));
    }

    /**
     * Releases an id so that it can be used again
     */
    release(id){
        return pq.add( () => {
            return new Promise( resolve => {
                this.availableIds.push(id);
                return resolve(id);
            });
        });
    }

    /**
     * Returns the next available id (peek)
     */
    nextFree(){
        return Promise.resolve( this.availableIds.pop() );
    }

    clear(){
        return pq.add( () => {
            return new Promise( (resolve) => {
                this.availableIds = [];
                this.currentId = this.defaultValue;
            })
        })
    }
}