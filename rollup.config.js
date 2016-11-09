import { readFileSync } from 'fs';
import Babel from 'rollup-plugin-babel';
import CommonJS from 'rollup-plugin-commonjs';
import Flow from 'rollup-plugin-flow';
import NodeResolve from 'rollup-plugin-node-resolve';
import Replace from 'rollup-plugin-replace';


const pkg = JSON.parse( readFileSync( 'package.json', 'utf-8' ) );


const banner = readFileSync( 'src/banner.js', 'utf-8' )
	.replace( '${version}', pkg.version )
	.replace( '${time}', new Date() )

export default {
    banner,
    entry: 'src/index.js',
    format: 'iife',
    moduleName: 'elsinore',
    dest: 'build/elsinore.js',
    sourceMap: true,
    plugins:[
        Replace({
            'process.env.NODE_ENV': JSON.stringify('development')
        }),
        Flow(),
        CommonJS({
            include: 'node_modules/**'
			// include: [
            //     'node_modules/underscore/underscore.js',
            //     'node_modules/deep-equal/index.js'
            // ],
		}),
        NodeResolve({preferBuiltins:true, jsnext:true,main:true}),
        Babel({
            babelrc: false,
			sourceMap: true,
            exclude: 'node_modules/**',
            presets: [
                "es2015-rollup"
            ],
            plugins: [
                "external-helpers",
                "transform-es2015-destructuring",
                "transform-object-rest-spread"
            ]
        })
    ]
}