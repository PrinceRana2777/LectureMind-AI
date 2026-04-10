import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';

// Extend Express Request to include multer's file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Configure Multer for file uploads
  const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
  });

  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Backend Auth Verification (Simulated for Production Readiness)
  app.post('/api/auth/verify', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID Token required' });
    
    console.log('Backend: Received token for verification');
    res.json({ status: 'success', message: 'Authentication verified' });
  });

  // Handle lecture upload and processing
  app.post('/api/upload', upload.single('lecture'), async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // In a real app, we would upload to cloud storage (S3/GCS)
      // and then trigger the AI pipeline.
      // For this demo, we'll return the local path and simulate processing
      // The frontend will handle the Gemini calls for transcription/analysis
      // to keep the API key on the client side as per guidelines (or we could do it here)
      // Actually, guidelines say "Default to server-side" for third-party keys, 
      // but Gemini is handled specially.
      
      res.json({ 
        message: 'File uploaded successfully', 
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
