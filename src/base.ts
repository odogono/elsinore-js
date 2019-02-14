import { hash } from './util/hash';
import { Events } from './util/events';
import { Registry } from './registry';
import { createUUID } from './util/uuid';
import { uniqueID } from './util/unique_id';
import { stringify } from './util/stringify'
import { readProperty } from './util/read_property';


export interface BaseOptions {
    uuid?:string;
    id?:number;
    registry?:Registry;
}



export class Base extends Events {
    readonly id: number = 0;
    
    readonly cid: string;

    readonly type: string = 'base';

    readonly uuid: string;

    readonly _registry: Registry;


    constructor( options:BaseOptions = {} ){
        super();

        this.id = readProperty(options,'id');
        
        this.cid = <string>uniqueID( this.getCIDPrefix() );

        this.uuid = readProperty(options, 'uuid', createUUID() );

        this._registry = readProperty(options, 'registry');

    }

    /**
     * Returns a prefix which is attached to the instances cid
     */
    getCIDPrefix() : string {
        return 'b';
    }

    getRegistry() : Registry {
        return this._registry;
    }

    // setRegistry( r : any ) {
    //     this._registry = r;
    // }

    getUUID() {
        return this.uuid;
    }

    isEqual(other) : boolean {
        return this.hash() === other.hash();
    }

    hash() : number {
        let result = this.toJSON();
        return <number>hash( stringify(result), false );
    }

    toJSON() : object {
        return {};
    }
}