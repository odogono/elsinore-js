import Replace from 'rollup-plugin-replace'
import Uglify from 'rollup-plugin-uglify'

// Import the development configuration.
import Config from './rollup.config'

// Inject the production settings.
Config.dest = 'build/elsinore.min.js'
Config.plugins[0] = Replace({ 'process.env.NODE_ENV': JSON.stringify('production') })
Config.plugins.push(Uglify());

export default Config;