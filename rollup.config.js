import { readFileSync } from 'fs';
import Babel from 'rollup-plugin-babel';
import CommonJS from 'rollup-plugin-commonjs';
import Flow from 'rollup-plugin-flow';
import NodeResolve from 'rollup-plugin-node-resolve';
import Replace from 'rollup-plugin-replace';
import Uglify from 'rollup-plugin-uglify';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

const banner = readFileSync('src/banner.js', 'utf-8').replace('${version}', pkg.version).replace('${time}', new Date());

export default {
    banner,
    entry: 'src/index.js',
    format: 'cjs',
    // moduleName: 'elsinore',
    dest: isProduction ? 'dist/elsinore.min.js' : 'dist/elsinore.js',
    sourceMap: true,
    plugins: [
        Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
        Flow(),
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
        CommonJS({}),
        isProduction && Uglify(),
    ],
}
