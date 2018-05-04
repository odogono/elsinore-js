import Babel from 'rollup-plugin-babel';
import CommonJS from 'rollup-plugin-commonjs';
import NodeResolve from 'rollup-plugin-node-resolve';

// rollup.config.js
export default {
    input: 'rolluptest.js',
    output: {
        file: 'rolluptest.bundle.js',
        format: 'cjs'
    },
    plugins: [
        Babel({
            babelrc: false,
            sourceMap: true,
            presets: ['es2015-rollup'],
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
        })
    ]
};
