import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { apiRouter } from '../../server/apiRouter';

const app = express();

app.use(cors());

// Mount the apiRouter which contains all the Stripe endpoints and webhook
app.use('/api', apiRouter);
app.use('/.netlify/functions/api', apiRouter);
app.use('/', apiRouter);

export const handler = serverless(app);
