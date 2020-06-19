import CommonJS from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
import Typescript from "@wessberg/rollup-plugin-ts";
// import MultiEntry from '@rollup/plugin-multi-entry';
import NodePolyfills from 'rollup-plugin-node-polyfills';
// import Json from '@rollup/plugin-json';
// import OMT from "@surma/rollup-plugin-off-main-thread";
import Path from 'path';

// import pkg from './package.json';
// import { readFileSync } from 'fs';

const environment = process.env.NODE_ENV || 'development';
const jsEnv = process.env.JS_ENV || 'browser';
const isProduction = false //environment === 'production';


const nameCache = { vars: {} };

function build({ external, format, minify, input, output:outputFile, ext = "js", globals }) {
    
    const minifierSuffix = minify ? ".min" : "";
    
    let compress = true;

    let output = {
      format,
      esModule: format === 'cjs' ? false : true,
      sourcemap: true,
      globals
    }

    if( typeof input === 'string' ){
      const base = Path.basename(outputFile || input).replace(/\.[^/.]+$/, "");
      output = {
        ...output,
        name: "odgn_entity",
        file: `dist/${format}/${base}${minifierSuffix}.${ext}`
      }
    } else {
      const entryFileNames = `[name]${minifierSuffix}.${ext}`;
      const chunkFileNames = `[name]-[hash]${minifierSuffix}.${ext}`
      output = {...output, 
        name: "odgn-entity",
        dir: `dist/${format}/`,
        entryFileNames,
        chunkFileNames,
      };
    }

    // note: terser does not handle ts classes seemingly
    // [!] (plugin terser) TypeError: Cannot read property 'references' of undefined
    compress = {
      defaults: false,
      arrows: true,
      booleans: true,
      collapse_vars: false, // <- this causes the typeerror!
      comparisons: true,
      computed_props: true,
      conditionals: true,
      dead_code: true,
      directives: true,
      // drop_console: true,
      drop_debugger: true,
      evaluate: true,
      hoist_props: true,
      if_return: true,
      inline: true,
      join_vars: true,
      keep_classnames: true,
      keep_fargs: true,
      keep_fnames: false,
      loops: true,
      module: true,
      negate_iife: true,
      properties: true,
      reduce_vars: true,
      sequences: true,
      side_effects: true,
      switches: true,
      toplevel: true,
      typeofs: true,
      unused: true,
      warnings: true
    };

    return {
      input, //: `./src/${input}.ts`,
      output,
      external,
      plugins: [
        Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
        Replace({ 'process.env.JS_ENV': JSON.stringify(jsEnv) }),
        NodePolyfills(),
        NodeResolve({ browser: true, preferBuiltins: false }),
        Typescript(),
        // typescriptPlugin,
        CommonJS({
            exclude: ['node_modules/type-detect/*.js'],
        }), // so Rollup can convert `ms` to an ES module
        minify
          ? terser({
              compress,
              mangle: true,
            })
          : undefined,
      ].filter(Boolean),
    };
}

const globals = {};
const external = [ 'better-sqlite3' ];
const config = {
  external,
  input:{
    index:'src/index.ts',
    idb:'src/entity_set_idb/index.ts',
    sql:'src/entity_set_sql/index.ts'
}};

const singleConfig = {
  input: 'src/index.browser.ts',
  output: 'index.ts',
};

export default [
  {...config, format: 'esm', minify:false, ext:'mjs'},
  {...config, format: 'esm', minify:true, ext:'mjs'},
  {...config, format: 'cjs', minify:false, ext:'js'},
  {...config, format: 'cjs', minify:true, ext:'js'},

  // {...singleConfig, format: 'amd', minify:false},
  // {...singleConfig, format: 'amd', minify:true},
  {...singleConfig, format: 'iife', minify:false},
  {...singleConfig, format: 'iife', minify:true},
  {...singleConfig, format: 'umd', minify:false},
  {...singleConfig, format: 'umd', minify:true},
].map(build);
