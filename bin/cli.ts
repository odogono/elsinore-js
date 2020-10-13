const vorpal = require('vorpal')();
const util = require('util');
const { createStdLibStack } = require('../src/query');
const { tokenizeString } = require('../src/query/tokenizer');

let stack = createStdLibStack();


vorpal
    .catch('[cmds...]', 'Catches incorrect commands')
    .action( async function (args, next) {
        let input = args.cmds.join(' ');

        let tokens = tokenizeString(input, {returnValues:true});

        await stack.pushValues(tokens);

        this.log( stack.toString(false), '<- top');

        // this.log('caught => my args:', util.inspect(args));
        next();
    });

vorpal
    .delimiter('ecs$')
    .show();