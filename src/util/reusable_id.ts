import { arrayWithout } from './array/without';

export class ReusableID {

    defaultValue:number = 1;
    activeIDs:number[] = [];
    availableIDs:number[] = [];
    currentID:number;

    constructor(defaultValue) {
        this.defaultValue = defaultValue === void 0 ? 1 : defaultValue;
        this.currentID = this.defaultValue;
    }

    /**
     * Returns a single re-useable id
     */
    get() {
        // return this.promiseQ.add( () => {
        return this.nextFree().then(val => {
            if (val) {
                return val;
            }

            // increment a new id
            const result = this.currentID;
            this.activeIDs.push(result);
            this.currentID = this.currentID + 1;
            return result;
        });
        // })
    }

    /**
     * Returns <count> new ids
     */
    getMultiple(count) {
        let ops = [];
        for (let ii = 0; ii < count; ii++) {
            ops.push(this.get());
        }
        return Promise.all(ops);
    }

    /**
     * Releases an id so that it can be used again
     */
    release(id) {
        // return this.promiseQ.add( () => {
        return new Promise((resolve, reject) => {
            // determine that this belongs to us
            if (this.activeIDs.indexOf(id) === -1) {
                return reject(new Error(`${id} is not a member`));
            }
            this.activeIDs = arrayWithout(this.activeIDs, id);
            this.availableIDs.push(id);
            return resolve(id);
        });
        // });
    }

    /**
     * Releases an array of ids
     */
    releaseMultiple(ids) {
        return Promise.all(ids.map(id => this.release(id)));
    }

    /**
     * Returns the next available id (peek)
     */
    nextFree() {
        return new Promise(resolve => {
            let free = this.availableIDs.pop();
            if (free === void 0) {
                return resolve(undefined);
            }
            this.activeIDs.push(free);
            return resolve(free);
        });
    }

    clear() {
        // return this.promiseQ.add( () => {
        return new Promise(resolve => {
            this.availableIDs = [];
            this.activeIDs = [];
            this.currentID = this.defaultValue;
        });
        // })
    }
}