const vorpal = require('vorpal')();
const util = require('util');
const { createStdLibStack } = require('../src/query');
const { tokenizeString } = require('../src/query/tokenizer');

let stack = createStdLibStack();

let rawInput = '';
let shouldCapture = true;

// have to capture raw, because vorpal will not respect
// things like quotes
process.stdin.on('data', captureRawInput);


vorpal
    // .mode('repl')
    .catch('[cmds...]', 'Catches incorrect commands')
    .action(async function (args, next) {
        let input = rawInput; //args.cmds.join(' ');

        let tokens = tokenizeString(input, { returnValues: true });
        console.log('incoming args', input, tokens);

        await stack.pushValues(tokens);

        this.log(stack.toString(false), '<- top');

        // this.log('caught => my args:', util.inspect(args));
        rawInput = '';
        next();
    });

vorpal
    .delimiter('ecs$')
    .show();


function captureRawInput(chunk) {
    const str = chunk.toString();
    if (shouldCapture && !str.includes('\r')) {
        rawInput += str;
    }
}