import CommonJS from '@rollup/plugin-commonjs';
import { terser as Minify } from 'rollup-plugin-terser';
import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
import Typescript from "rollup-plugin-typescript2";
import MultiEntry from '@rollup/plugin-multi-entry';
import NodePolyfills from 'rollup-plugin-node-polyfills';

// import pkg from './package.json';
// import { readFileSync } from 'fs';

const environment = process.env.NODE_ENV || 'development';
const isProduction = false; //environment === 'production';

const typescriptPlugin = Typescript({
    tsconfigOverride: { compilerOptions : { module: "es2015" } },
    tsconfig: './tsconfig.json',
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
            NodePolyfills(),
            NodeResolve({ browser: true, preferBuiltins: false }),
            typescriptPlugin,
            CommonJS(), // so Rollup can convert `ms` to an ES module
            // MultiEntry(),
            // NodePolyfills({ buffer: true, process: true }),
            // isProduction && Minify()
            // Minify()
        ]
    }
];
