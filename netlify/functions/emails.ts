import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import dotenv from 'dotenv';
import emailRoutes from '../../server/emailRoutes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/.netlify/functions/emails', emailRoutes);
app.use('/api/emails', emailRoutes);
app.use('/emails', emailRoutes);
app.use('/', emailRoutes);

export const handler = serverless(app);
