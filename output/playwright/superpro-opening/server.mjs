import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.webm':'video/webm'};
http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
  if(name.includes('/')||name.includes('\\')||!types[path.extname(name)]){res.writeHead(404).end();return;}
  const file=path.join(base,name);if(!fs.existsSync(file)){res.writeHead(404).end();return;}
  const size=fs.statSync(file).size,range=req.headers.range;
  res.setHeader('Content-Type',types[path.extname(file)]);res.setHeader('Accept-Ranges','bytes');
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match){res.writeHead(416).end();return;}const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),size-1):size-1;if(start>=size||end<start){res.writeHead(416).end();return;}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);}
  else{res.writeHead(200,{'Content-Length':size});fs.createReadStream(file).pipe(res);}
}).listen(4179,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4179'));
