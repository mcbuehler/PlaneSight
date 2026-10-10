import http from 'node:http';
import { readFileSync } from 'node:fs';
import { currentUser, projects } from './src/projects.js';
import { listProjects } from './src/api.js';
http.createServer((req, res) => {
  if (req.url === '/api/projects') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(listProjects(currentUser, projects))); return; }
  res.setHeader('Content-Type', 'text/html'); res.end(readFileSync(new URL('./public/index.html', import.meta.url)));
}).listen(7788, '127.0.0.1', () => console.log('CrewBoard on http://127.0.0.1:7788'));
