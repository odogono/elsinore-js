import _ from 'underscore';
// import PromiseQ from 'promise-queue';

export default class ReusableId {

    constructor( defaultValue ){
        this.defaultValue = _.isUndefined(defaultValue) ? 1 : defaultValue;
        this.activeIds = [];
        this.availableIds = [];
        // this.promiseQ = new PromiseQ(1);
        this.currentId = this.defaultValue;
    }


    /**
     * Returns a single re-useable id
     */
    get(){
        // return this.promiseQ.add( () => {
            return this.nextFree()
                .then( val => {
                    if( val ){
                        return val;
                    }

                    // increment a new id
                    const result = this.currentId;
                    this.activeIds.push( result );
                    this.currentId = this.currentId + 1;
                    return result;
                })
        // })
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
        // return this.promiseQ.add( () => {
            return new Promise( (resolve,reject) => {
                
                // determine that this belongs to us
                if( _.indexOf(this.activeIds,id) === -1 ){
                    return reject(new Error(`${id} is not a member`));
                }
                this.activeIds = _.without( this.activeIds, id );
                this.availableIds.push(id);
                return resolve(id);
            });
        // });
    }

    /**
     * Releases an array of ids
     */
    releaseMultiple(ids){
        return Promise.all( _.map(ids, id => this.release(id) ));
    }

    /**
     * Returns the next available id (peek)
     */
    nextFree(){
        return new Promise( (resolve) => {
             let free = this.availableIds.pop();
             if( _.isUndefined(free) ){
                 return resolve(undefined);
             } 
             this.activeIds.push(free);
             return resolve(free);
        });
    }

    clear(){
        // return this.promiseQ.add( () => {
            return new Promise( (resolve) => {
                this.availableIds = [];
                this.activeIds = [];
                this.currentId = this.defaultValue;
            })
        // })
    }
}