import _source from './source';
import _sink from './sink';

export const source = _source;
export const sink = _sink;

export function duplex( entitySet, options={}){

    // const did = _.uniqueId('eldup');

    // the source sends
    const source = _source(entitySet, options );
    // the sink receives - it needs a reference so that it can
    // send back replies
    const sink = _sink(entitySet, {...options, source, did} );

    return {
        source,
        sink
    }
}