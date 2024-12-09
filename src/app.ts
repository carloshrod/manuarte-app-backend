import express, { json, urlencoded } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import router from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { credentials } from './middlewares/credentials';
import { corsOptions } from './middlewares/corsOptions';

const app = express();

app.use(credentials);
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(json());
app.use(cookieParser());
app.use(urlencoded({ extended: false }));

app.use(router);

app.use(errorHandler);

export default app;
