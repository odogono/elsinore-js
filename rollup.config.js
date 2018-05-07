import { readFileSync } from 'fs';
import Babel from 'rollup-plugin-babel';
import CommonJS from 'rollup-plugin-commonjs';
import NodeResolve from 'rollup-plugin-node-resolve';
import Replace from 'rollup-plugin-replace';
import Uglify from 'rollup-plugin-uglify';

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

const banner = readFileSync('src/banner.js', 'utf-8')
    .replace('${version}', pkg.version)
    .replace('${time}', new Date());

import pkg from './package.json';

const babelPlugin = Babel({
    babelrc: false,
    sourceMap: true,
    exclude: 'node_modules/**',
    presets: ['es2015-rollup'],
    plugins: [
        'transform-inline-environment-variables',
        'transform-object-rest-spread',
        'transform-es2015-shorthand-properties'
    ]
});

export default [
    // browser-friendly UMD build
    {
        input: 'src/index.js',
        output: {
            name: 'elsinore',
            file: pkg.browser,
            format: 'umd'
        },
        plugins: [
            Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
            babelPlugin,
            NodeResolve(),
            CommonJS(), // so Rollup can convert `ms` to an ES module
            isProduction && Uglify()
        ]
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    // (We could have three entries in the configuration array
    // instead of two, but it's quicker to generate multiple
    // builds from a single configuration where possible, using
    // an array for the `output` option, where we can specify
    // `file` and `format` for each target)
    {
        input: 'src/index.js',
        // external: ['ms'],
        output: [{ file: pkg.main, format: 'cjs' }, { file: pkg.module, format: 'es' }],
        plugins: [
            Babel({
                babelrc: false,
                sourceMap: true,
                plugins: [
                    'transform-inline-environment-variables',
                    'transform-object-rest-spread',
                    // uglifyjs has been having problems with this
                    'transform-es2015-shorthand-properties'
                ]
            }),
            NodeResolve(),
            CommonJS({
                namedExports: {
                    'node_modules/odgn-bitfield/index.js': ['BitField']
                }
            }),
            isProduction && Uglify()
        ]
    }
];