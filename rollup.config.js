import CommonJS from 'rollup-plugin-commonjs';
import { terser as Minify } from 'rollup-plugin-terser';
import NodeResolve from 'rollup-plugin-node-resolve';
import Replace from 'rollup-plugin-replace';
import Typescript from 'rollup-plugin-typescript';
import pkg from './package.json';
import { readFileSync } from 'fs';

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

const banner = readFileSync('./banner.txt', 'utf-8')
    .replace('${version}', pkg.version)
    .replace('${time}', new Date());

const typescriptPlugin = Typescript({
    typescript: require('typescript')
});

const sourcemap = isProduction;

export default [
    // browser-friendly UMD build
    {
        input: 'src/index.ts',
        output: {
            name: 'elsinore',
            file: pkg.browser,
            format: 'umd',
            sourcemap
        },
        plugins: [
            Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
            typescriptPlugin,
            NodeResolve(),
            CommonJS(), // so Rollup can convert `ms` to an ES module
            isProduction && Minify()
        ]
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    // (We could have three entries in the configuration array
    // instead of two, but it's quicker to generate multiple
    // builds from a single configuration where possible, using
    // an array for the `output` option, where we can specify
    // `file` and `format` for each target)
    {
        input: 'src/index.ts',
        // external: ['ms'],
        output: [
            { file: pkg.main, format: 'cjs', sourcemap },
            { file: pkg.module, format: 'es', sourcemap }
        ],
        plugins: [
            Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
            typescriptPlugin,
            NodeResolve(),
            CommonJS(),
            // CommonJS({
            //     namedExports: {
            //         'node_modules/odgn-bitfield/index.js': ['BitField']
            //     }
            // }),
            isProduction && Minify()
        ]
    }
];
