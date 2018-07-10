/**
 * Parses an EJSON style string
 *
 * @param {*} data
 * @param {*} options
 */
export function parse(data, options = {}) {
    // first, try standard JSON
    try {
        return JSON.parse(data);
    } catch (err) {}

    // move to extended
    return parseExtended(data, options);
}


/**
 * 
 */
export function through(){
    return function (read) {
        return function next(end, cb) {
            let sync,
                loop = true;
            while (loop) {
                loop = false;
                sync = true;
                read(end, function (end, data) {
                    // the incoming data will normally be [value,valueOptions]
                    
                    if (!end && !applyQueryFilter(query, data[0], data[1])) {
                        return sync ? loop = true : next(end, cb);
                    }
                    cb(end, data);
                });
                sync = false;
            }
        };
    };
}

/**
 * The result will be an array of javascript objects
 */
export function parseExtended(data, options = {}) {
    let len = data.length;
    let pos = 0;

    let context = {
        data,
        pos: 0,
        len: data.length,
        objects: [],
        error: ''
    };

    // split the data into line ranges, so that we get better reporting later
    let lines = data.match(/[^\r\n]+/g);
    let ranges = lines.map(line => line.length);

    context = parseExpecting(context);

    context.objects.forEach( obj => console.log(obj) );
    context.objects = context.objects.map(obj => {
        try {
            return JSON.parse(obj);
        } catch (err) {
            throw new Error('unable to parse: ' + err.message, obj);
        }
    });

    return context.objects;
}

function parseExpecting(context) {
    let { pos, len, data } = context;

    for (pos; pos < len; pos++) {
        const char = data.charAt(pos);
        switch (char) {
            case '/':
                if (pos + 1 < len && data.charAt(pos + 1) == '/') {
                    context = parseComment({ ...context, pos: pos + 1 });
                    pos = context.pos;
                }
                break;
            case '#':
                context = parseComment({ ...context, pos });
                // Log.debug('parse comment from', pos, context.pos);
                pos = context.pos;
                break;
            case '[':
            case '{':
                context = parseObject({ ...context, pos }, char);
                // console.log('parseExpecting object', pos, context.buffer);
                context.objects.push(context.buffer);
                pos = context.pos;
                break;
            default:
                break;
        }
    }

    return context;
}

function parseComment(context) {
    const { len, data } = context;
    let { pos } = context;

    for (pos; pos < len; pos++) {
        const char = data.charAt(pos);
        switch (char) {
            case '\r':
                return { ...context, pos };
            case '\n':
                return { ...context, pos };
        }
    }

    return { ...context, pos };
}

function parseObject(context, openingChar = '{') {
    const { len, data } = context;
    let { pos } = context;
    let closingChar = '}';
    if (openingChar == '[') {
        closingChar = ']';
    }
    let previous = '';
    let previousPos = 0;
    let buffer = '';
    let stack = 0;
    let debug = false;

    for (pos; pos < len; pos++) {
        const char = data.charAt(pos);

        buffer += char;

        if (char == openingChar) {
            // Log.debug('parseObject. object open', char, pos, stack);
            stack = stack + 1;
            // if( char == '['){ debug = true };
        } else if (char == closingChar) {
            stack = stack - 1;
            // Log.debug('parseObject. object close', char, pos, stack, `'${previous}'`);

            // if the previous character was a comma - be kind and remove it so that the JSON will parse
            if (previous == ',') {
                // clear the last comma character
                buffer = buffer.substring(0, buffer.lastIndexOf(',')) + '}';
            }

            if (stack <= 0) {
                return { ...context, pos, buffer };
            }
        } else {
            // if( debug ){
            //     Log.debug('  parseObject. char', char, pos );
            // }
            switch (char) {
                case '/':
                    if (pos + 1 < len && data.charAt(pos + 1) == '/') {
                        context = parseComment({ ...context, pos: pos + 1 });
                        pos = context.pos;
                        buffer = buffer.slice(0, -1);
                    }
                    break;
                case '#':
                    context = parseComment({ ...context, pos });
                    pos = context.pos;
                    buffer = buffer.slice(0, -1);
                    break;
                case '"':
                    context = parseString({ ...context, pos });
                    // Log.debug('parse string from', pos, context.pos, '"' + context.buffer);
                    buffer += context.buffer;
                    pos = context.pos;
                    break;
                // case '}':
                //     break;

                // case '{':
                //     Log.debug('parseObject. object open', pos, stack);
                //     stack = stack + 1;
                //     // context = parseObject({...context,pos});
                //     // Log.debug('parseExpecting open object', pos);
                //     // pos = context.pos;
                //     break;
                default:
                    break;
            }
        }
        if (char != ' ' && char != '\n') {
            previous = char;
            // previousPos = buffer.length;
        }
    }

    return { ...context, pos, buffer };
}

/**
 *
 */
function parseString(context, stringChar = '"') {
    const { len, data } = context;
    let { pos } = context;
    const initialPos = pos;
    let previous = '';
    let buffer = '';

    for (pos; pos < len; pos++) {
        const char = data.charAt(pos);
        buffer += char;
        if (char == '\\' && data.charAt(pos + 1) == '"') {
            buffer = buffer.slice(0, -1);
            buffer += '\\"';
            pos = pos + 1;
        } else {
            switch (char) {
                case '"':
                    if (pos > initialPos) return { ...context, pos, buffer };
                    buffer = buffer.slice(0, -1);
                    break;
                case '\n':
                    // remove newlines
                    buffer = buffer.slice(0, -1);
                    break;
            }
        }
        previous = char;
    }

    return { ...context, pos, buffer };
}
