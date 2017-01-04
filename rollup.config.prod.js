import Replace from 'rollup-plugin-replace'
import Uglify from 'rollup-plugin-uglify'
import { minify } from 'uglify-js';

// Import the development configuration.
import Config from './rollup.config'

// Inject the production settings.
Config.dest = 'dist/elsinore.min.js'
Config.plugins[0] = Replace({ 'process.env.NODE_ENV': JSON.stringify('production'), 'process.env.NO_LOG': true })
Config.plugins.push(Uglify({}, minify));

export default Config;