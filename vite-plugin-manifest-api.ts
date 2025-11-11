// Vite plugin to handle manifest file operations via API routes
import { Plugin } from 'vite';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Rebuild media.manifest.json by scanning all MANIFEST.txt files
 */
async function rebuildMediaManifest() {
  try {
    console.log('🔄 Rebuilding media.manifest.json...');
    await execAsync('npm run build:manifest');
    console.log('✅ media.manifest.json rebuilt successfully');
  } catch (error: any) {
    console.error('❌ Failed to rebuild media.manifest.json:', error.message);
  }
}

export function manifestApiPlugin(): Plugin {
  return {
    name: 'manifest-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        
        // Match /api/manifest/:folder routes
        const manifestMatch = url.match(/^\/api\/manifest\/(\d+)(\?.*)?$/);
        
        if (!manifestMatch) {
          return next();
        }
        
        const folder = manifestMatch[1];
        const manifestPath = path.join(process.cwd(), 'public', 'media', 'hidrive', folder, 'MANIFEST.txt');
        
        // GET - Read manifest
        if (req.method === 'GET') {
          try {
            const content = await fs.readFile(manifestPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, content }));
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, content: '' }));
            } else {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          }
          return;
        }
        
        // PUT - Save/update manifest
        if (req.method === 'PUT') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', async () => {
            try {
              const folderPath = path.join(process.cwd(), 'public', 'media', 'hidrive', folder);
              
              // Ensure directory exists
              await fs.mkdir(folderPath, { recursive: true });
              
              // Write file
              await fs.writeFile(manifestPath, body, 'utf-8');
              
              console.log(`✓ Saved manifest for folder ${folder}`);
              
              // Rebuild media.manifest.json to include the new metadata
              await rebuildMediaManifest();
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error: any) {
              console.error('Error saving manifest:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          });
          return;
        }
        
        // DELETE - Delete manifest
        if (req.method === 'DELETE') {
          try {
            await fs.unlink(manifestPath);
            console.log(`✓ Deleted manifest for folder ${folder}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          }
          return;
        }
        
        // Method not allowed
        res.statusCode = 405;
        res.end('Method Not Allowed');
      });
    },
  };
}
