import CommonJS from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
import Typescript from "rollup-plugin-typescript2";
import MultiEntry from '@rollup/plugin-multi-entry';
import NodePolyfills from 'rollup-plugin-node-polyfills';
import Json from '@rollup/plugin-json';
import OMT from "@surma/rollup-plugin-off-main-thread";

// import pkg from './package.json';
// import { readFileSync } from 'fs';

const environment = process.env.NODE_ENV || 'development';
const jsEnv = process.env.JS_ENV || 'browser';
const isProduction = false //environment === 'production';

const tsconfigOverride = { compilerOptions: { declaration: false, sourceMap: true, module: "es2015" } };

const typescriptPlugin = Typescript({
    // Disable type checking during the build
    // to increase the build speed.
    check: false,
    tsconfig: './tsconfig.json',
    tsconfigOverride,
    typescript: require('typescript'),
    useTsconfigDeclarationDir: true
});


function build({ format, minify, input, ext = "js", globals }) {
    const dir = `dist/${format}/`;
    const minifierSuffix = minify ? ".min" : "";
    const base = input.replace(/\.[^/.]+$/, "");
    return {
      input,
      output: {
        name: "odgn_entity",
        // dir,
        file: `${dir}/${base}${minifierSuffix}.${ext}`,
        format,
        sourcemap: true,
        globals
      },
      external: ['chai', 'it', 'describe'],
      plugins: [
        Replace({ 'process.env.NODE_ENV': JSON.stringify(environment) }),
        Replace({ 'process.env.JS_ENV': JSON.stringify(jsEnv) }),
        NodePolyfills(),
        NodeResolve({ browser: true, preferBuiltins: false }),
        typescriptPlugin,
        CommonJS({
            exclude: ['node_modules/type-detect/*.js'],
        }), // so Rollup can convert `ms` to an ES module
        minify
          ? terser({
              sourcemap: true,
              compress: true,
              mangle: true,
            })
          : undefined,
      ].filter(Boolean),
    };
}

const testGlobals = {chai: 'chai', it: 'it', describe: 'describe' };
const config = {input:'test/index.ts', globals:testGlobals};

export default [
    {...config, format: 'esm', minify:false, ext:'mjs'},
    {...config, format: 'esm', minify:true, ext:'mjs'},
    {...config, format: 'amd', minify:false},
    {...config, format: 'amd', minify:true},
    {...config, format: 'iife', minify:false},
    {...config, format: 'iife', minify:true},
    {...config, format: 'umd', minify:false},
    {...config, format: 'umd', minify:true},
].map(build);
