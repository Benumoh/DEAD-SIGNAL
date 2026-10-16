import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);
const port = Number(process.env.PORT || 8000);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.resolve(root, `.${pathname}`);
    if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const content = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(filename)) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      response.writeHead(404).end('Not found');
      return;
    }
    console.error('Static preview server failed:', error);
    response.writeHead(500).end('Static preview server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`DEAD SIGNAL is ready at http://127.0.0.1:${port}`);
});
