import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const publicRoot = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

export function createStaticServer() {
  return createServer(async (request, response) => {
    const notFound = () => {
      response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found');
    };
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) { notFound(); return; }
      const file = await realpath(path.resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`));
      if (!file.startsWith(`${publicRoot}${path.sep}`) || !(await stat(file)).isFile()) { notFound(); return; }
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}${['.html', '.mjs', '.js', '.css', '.json'].includes(path.extname(file)) ? '; charset=utf-8' : ''}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error?.code)) { notFound(); return; }
      if (error instanceof URIError) {
        response.writeHead(400, { 'Content-Type': 'text/plain' }); response.end('Invalid path'); return;
      }
      console.error('Public preview could not serve a file:', error);
      response.writeHead(500, { 'Content-Type': 'text/plain' }); response.end('Unable to serve public file');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createStaticServer();
  const port = Number(process.env.PORT || 8080);
  server.listen(port, '127.0.0.1', () => console.log(`Public-only preview: http://127.0.0.1:${port}`));
}
