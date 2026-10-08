import express, { Request, Response } from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import dotenv from 'dotenv';
import emailRoutes from '../../server/emailRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Support multiple routing prefixes depending on how Netlify rewrites the request:
// 1. Direct /api/emails rewrite (from /api/* -> /.netlify/functions/api/:splat)
app.use('/api/emails', emailRoutes);

// 2. Direct Netlify function path
app.use('/.netlify/functions/api/emails', emailRoutes);
app.use('/.netlify/functions/api', emailRoutes);

// 3. Sub-path if splat stripped /api
app.use('/emails', emailRoutes);

// Health check endpoint for Netlify functions
app.get('/.netlify/functions/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Montford Digital Netlify Functions' });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Montford Digital API' });
});

export const handler = serverless(app);
