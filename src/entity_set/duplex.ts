import { PullStreamSink } from './sink';
import { PullStreamSource } from './source';

export const source = PullStreamSource;
export const sink = PullStreamSink;

export function duplex( entitySet, options={}){

    // const did = _.uniqueID('eldup');

    // the source sends
    const source = PullStreamSource(entitySet, options );
    // the sink receives - it needs a reference so that it can
    // send back replies
    const sink = PullStreamSink(entitySet, {...options, source/*, did*/} );

    return {
        source,
        sink
    }
}