import { readFileSync } from 'fs';
import Babel from 'rollup-plugin-babel';
import CommonJS from 'rollup-plugin-commonjs';
import NodeResolve from 'rollup-plugin-node-resolve';
import Replace from 'rollup-plugin-replace';
import Uglify from 'rollup-plugin-uglify';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

const banner = readFileSync('src/banner.js', 'utf-8').replace('${version}', pkg.version).replace('${time}', new Date());

export default {
    banner,
    format: 'es',
    entry: 'src/index.js',
    dest: isProduction ? 'dist/elsinore.module.min.js' : 'dist/elsinore.module.js',
    sourceMap: true,
    plugins: [
        Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
        Babel({
            babelrc: false,
            sourceMap: true,
            exclude: 'node_modules/**',
            presets: [ 'es2015-rollup' ],
            plugins: [
                // "external-helpers",
                // "transform-es2015-destructuring",
                'transform-inline-environment-variables',
                'transform-object-rest-spread',
                // uglifyjs has been having problems with this
                'transform-es2015-shorthand-properties',
            ],
        }),
        NodeResolve({ preferBuiltins: true, jsnext: true, main: true }),
        CommonJS({
            // include: [
            //     'node_modules/underscore/underscore.js',
            //     'node_modules/deep-equal/index.js'
            // ],
            include: 'node_modules/**',
        }),
        isProduction && Uglify(),
    ],
}
