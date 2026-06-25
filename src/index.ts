import express from 'express';
import pinoHttp from 'pino-http';
import { commissionsRouter } from './routes/commissions';
import { logger } from './logger';
import cookieParser from 'cookie-parser';

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(cookieParser());


app.use('/v1/commissions', commissionsRouter);

app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
});



export default app;

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? '3000', 10);
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}
