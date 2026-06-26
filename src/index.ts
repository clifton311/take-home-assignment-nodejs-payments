import 'reflect-metadata';
import express from 'express';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import { commissionsRouter } from './routes/commissions';
import { logger } from './logger';
import { AppDataSource } from './db/datasource';

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(cookieParser());


app.use('/api/v1/commissions', commissionsRouter);

app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
});



export default app;

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? '3000', 10);
  AppDataSource.initialize()
    .then(() => {
      app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT}`);
      });
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to initialize database');
      process.exit(1);
    });
}
