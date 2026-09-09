const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 9000;
const BACKEND_PORT = 9001;
const DIST_DIR = path.join(__dirname, 'dist');

function serveStatic(req, res) {
  let urlPath = req.url;
  if (urlPath.startsWith('/package_check')) {
    urlPath = urlPath.substring('/package_check'.length) || '/';
  }
  
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain'
  };
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (urlPath.startsWith('/package_check') || urlPath === '/') {
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    }
  });
}

function proxyBackend(req, res) {
  const parsedUrl = url.parse(req.url);
  let proxyPath = parsedUrl.path.replace('/package_check', '');
  if (!proxyPath.startsWith('/api/')) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: proxyPath,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const cleanUrl = req.url.replace(/^\/package_check/, '') || '/';
  if (cleanUrl.startsWith('/api/')) {
    return proxyBackend(req, res);
  }
  return serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend serving on http://0.0.0.0:${PORT}/package_check/`);
  console.log(`API proxied to http://127.0.0.1:${BACKEND_PORT}`);
});
