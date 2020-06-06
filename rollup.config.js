import CommonJS from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
import Typescript from "rollup-plugin-typescript2";
import ts from "@wessberg/rollup-plugin-ts";
import MultiEntry from '@rollup/plugin-multi-entry';
import NodePolyfills from 'rollup-plugin-node-polyfills';
import Json from '@rollup/plugin-json';
import OMT from "@surma/rollup-plugin-off-main-thread";
import Path from 'path';

// import pkg from './package.json';
// import { readFileSync } from 'fs';

const environment = process.env.NODE_ENV || 'development';
const jsEnv = process.env.JS_ENV || 'browser';
const isProduction = false //environment === 'production';

const tsconfigOverride = { compilerOptions: { declaration: true, sourceMap: true, module: "es2015" } };

const typescriptPlugin = Typescript({
    // Disable type checking during the build
    // to increase the build speed.
    check: false,
    tsconfig: './tsconfig.json',
    tsconfigOverride,
    typescript: require('typescript'),
    useTsconfigDeclarationDir: true
});


function build({ external, format, minify, input, ext = "js", globals }) {
    const dir = `dist/${format}/`;
    const minifierSuffix = minify ? ".min" : "";
    const entryFileNames = `[name]${minifierSuffix}.${ext}`;
    const chunkFileNames = `[name]-[hash]${minifierSuffix}.${ext}`
    // const base = Path.basename(input).replace(/\.[^/.]+$/, "");
    // console.log('[build]', format, base );
    return {
      input, //: `./src/${input}.ts`,
      output: {
        name: "odgn-entity",
        // file: `${dir}/${base}${minifierSuffix}.${ext}`,
        dir,
        entryFileNames,
        chunkFileNames,
        format,
        esModule: format === 'cjs' ? false : true,
        sourcemap: true,
        globals
      },
      external,
      plugins: [
        Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
        Replace({ 'process.env.JS_ENV': JSON.stringify(jsEnv) }),
        NodePolyfills(),
        NodeResolve({ browser: true, preferBuiltins: false }),
        ts(),
        // typescriptPlugin,
        CommonJS({
            exclude: ['node_modules/type-detect/*.js'],
        }), // so Rollup can convert `ms` to an ES module
        minify
          ? terser({
              compress: true,
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
export default [
  {...config, format: 'esm', minify:false, ext:'mjs'},
  {...config, format: 'esm', minify:true, ext:'mjs'},
  {...config, format: 'cjs', minify:false, ext:'js'},
  {...config, format: 'cjs', minify:true, ext:'js'},
  // {...config, format: 'amd', minify:false},
  // {...config, format: 'amd', minify:true},
  // {...config, format: 'iife', minify:false},
  // {...config, format: 'iife', minify:true},
  // {...config, format: 'umd', minify:false},
  // {...config, format: 'umd', minify:true},
].map(build);
