import TempDir from 'temp-dir';
import Fs from 'fs-extra';
import Path from 'path';
import { createLog } from '../util/log';

const Log = createLog('Fs');


export interface FsRef {
    name: string;
    // path to the folder on the filesystem
    path: string;
}


export function fsCreateRef( name:string, path:string ):FsRef {
    path = path || fsTmpDir();
    return {
        name,
        path
    }
}

export async function fsOpen( ref:FsRef ): Promise<FsRef> {
    // Log.debug('[fsOpen]', ref );
    const path = fsPath(ref);
    // Log.debug('[fsOpen]', path );

    await Fs.ensureDir( path );

    return ref;
}

export async function fsDelete( ref:FsRef ): Promise<FsRef> {
    const path = fsPath(ref);
    await Fs.remove( path );
    return ref;
}

export async function fsExists( ref:FsRef, name:string ): Promise<boolean> {
    const path = fsPath(ref, name );
    return Fs.pathExists(path);
}

export async function fsReadFile( ref:FsRef, name:string ): Promise<string> {
    const path = fsPath(ref, name );

    // Log.debug('[fsReadFile]', path);

    // const data = Fs.readFileSync( path, 'utf8');
    // return Promise.resolve(data);

    try {
        const data = await Fs.readFile(path, 'utf8');
        return data;
    } catch( err ){
        Log.debug('[fsReadFile]', 'error', path, err.code );
        // throw err;
        return undefined;
    }
    
    // return new Promise( (res,rej) => Fs.readFile( path, 'utf8', (err,data) => {
    //     if( err ){ 
    //         Log.debug('[fsReadFile]', 'error', path, err.code );
    //         return res(undefined); 
    //     }
    //     return res(data);
    // }) );
}

export async function fsWriteFile( ref:FsRef, name:string, data ): Promise<FsRef> {
    const path = fsPath(ref, name );

    // Fs.writeFileSync(path, data, 'utf8' );
    // return Promise.resolve(ref);

    await Fs.writeFile(path, data, 'utf8');

    // Log.debug('[fsWriteFile]', path);
    return ref;

    // return new Promise( (resolve,reject) => Fs.writeFile( path, data, 'utf8', (err) => {
    //     if( err ) return reject(err);
    //     return resolve(ref); //Log.debug('[fsWriteFile]', 'done', path);
    // }) );

    // return ref;
}

// export function exists(ref:FsRef):boolean {
//     return Fs.existsSync( path(ref) );
// }

export function fsTmpDir(){
    return TempDir;
}

export function fsPath(ref:FsRef, name?:string ):string {
    const root = Path.join(ref.path, ref.name);
    return name !== undefined ? Path.join(root,name) : root;
}

function pathEntity(ref:FsRef):string {
    return Path.join(ref.path, ref.name, 'entity.csv');
}

function pathEntityComponents(ref:FsRef):string {
    return Path.join(ref.path, ref.name, 'entity_coms.csv');
}

function pathComponentDefs(ref:FsRef):string {
    return Path.join(ref.path, ref.name, 'cdefs.csv');
}