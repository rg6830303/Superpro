const esbuild=require('../superpro-opening/node_modules/esbuild');
const fs=require('node:fs'),path=require('node:path');
// Read only explicit project files; avoid the bundler's ancestor-directory scan.
esbuild.build({absWorkingDir:__dirname,entryPoints:['./film.js'],bundle:true,minify:true,format:'iife',tsconfigRaw:{},outfile:'film.bundle.js',logLevel:'info',plugins:[{name:'workspace-files',setup(build){
 build.onResolve({filter:/.*/},args=>({path:args.path==='three'?path.resolve(__dirname,'../superpro-opening/node_modules/three/build/three.module.js'):path.resolve(args.importer?path.dirname(args.importer):__dirname,args.path),namespace:'workspace'}));
 build.onLoad({filter:/.*/,namespace:'workspace'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:args.path.endsWith('.json')?'json':'js'}));
}}]}).catch(e=>{console.error(e.message);process.exitCode=1;});
