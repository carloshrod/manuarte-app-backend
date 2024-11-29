import express, { json, urlencoded } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import router from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(json());
app.use(cookieParser());
app.use(urlencoded({ extended: false }));

app.use(router);

app.use(errorHandler);

export default app;
