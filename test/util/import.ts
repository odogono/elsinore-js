import Pull from 'pull-stream';
import PullFile from 'pull-file';
import Path from 'path';
import { Through as odgnJSON } from 'odgn-json';


export async function loadFixture(name:string): Promise<any[]> {

    return new Promise( (resolve,reject) => {
        
        const inputFile = Path.resolve(__dirname, `../fixtures/${name}` );

        Pull(
            // a source which convert the input array into a stream of values
            // Pull.values(input),
            PullFile(inputFile, { bufferSize: 40 }),
            odgnJSON(),
            Pull.collect((err:Error, array:any[]) => {
                if( err ){
                    return reject(err);
                }
                return resolve(array);
            })
        )

    })
}