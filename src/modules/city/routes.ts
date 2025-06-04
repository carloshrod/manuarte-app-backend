import { Router } from 'express';
import { CityService } from './service';
import { CityModel } from './model';
import { CityController } from './controller';

const router = Router();

const cityService = new CityService(CityModel);

const cityController = new CityController(cityService);

router.get('/search', cityController.search);

export default router;
