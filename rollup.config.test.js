import CommonJS from '@rollup/plugin-commonjs';
import { terser as Minify } from 'rollup-plugin-terser';
import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
import Typescript from "rollup-plugin-typescript2";
import MultiEntry from '@rollup/plugin-multi-entry';
import NodePolyfills from 'rollup-plugin-node-polyfills';
import Json from '@rollup/plugin-json';

// import pkg from './package.json';
// import { readFileSync } from 'fs';

const environment = process.env.NODE_ENV || 'development';
const jsEnv = process.env.JS_ENV || 'browser';
const isProduction = false //environment === 'production';

const tsconfigOverride = { compilerOptions: { declaration: false, sourceMap: true, module: "es2015" } };

const typescriptPlugin = Typescript({
    // Disable type checking during the build
    // to increase the build speed.
    check: false,
    tsconfig: './tsconfig.json',
    tsconfigOverride,
    typescript: require('typescript'),
    useTsconfigDeclarationDir: true
});

export default [
    // browser-friendly UMD build
    {
        input: 'test/index.ts',
        output: {
            name: 'test',
            file: 'dist/elsinore.tests.js',
            format: 'iife',
            sourcemap: true,
            globals: {
                chai: 'chai',
                it: 'it',
                describe: 'describe'
            }
        },
        external: ['chai', 'it', 'describe'],
        plugins: [
            Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
            Replace({ 'process.env.JS_ENV': JSON.stringify(jsEnv) }),
            NodePolyfills(),
            NodeResolve({ browser: true, preferBuiltins: false }),
            typescriptPlugin,
            CommonJS(), // so Rollup can convert `ms` to an ES module
            Json(),
            // MultiEntry(),
            // NodePolyfills({ buffer: true, process: true }),
            isProduction && Minify()
            // Minify()
        ]
    }
];
