import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

import { connectDB } from './models';
import routes from './routes';

app.use('/api', routes);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'HRMS Admin Backend is running' });
});

app.listen(port, async () => {
  await connectDB();
  console.log(`[Server]: HRMS Admin Backend is running at http://localhost:${port}`);
});
