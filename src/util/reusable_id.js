import arrayWithout from './array/without';

export default class ReusableId {

    constructor( defaultValue ){
        this.defaultValue = defaultValue === void 0 ? 1 : defaultValue;
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
        let ops = [];
        for(let ii=0; ii < count; ii++){
            ops.push( this.get() );
        }
        return Promise.all( ops );
    }

    /**
     * Releases an id so that it can be used again
     */
    release(id){
        // return this.promiseQ.add( () => {
        return new Promise( (resolve,reject) => {
                
                // determine that this belongs to us
            if( this.activeIds.indexOf(id) === -1 ){
                return reject(new Error(`${id} is not a member`));
            }
            this.activeIds = arrayWithout( this.activeIds, id );
            this.availableIds.push(id);
            return resolve(id);
        });
        // });
    }

    /**
     * Releases an array of ids
     */
    releaseMultiple(ids){
        return Promise.all( ids.map(id => this.release(id) ));
    }

    /**
     * Returns the next available id (peek)
     */
    nextFree(){
        return new Promise( (resolve) => {
            let free = this.availableIds.pop();
            if( free === void 0 ){
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