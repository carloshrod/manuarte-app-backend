import { AuthController } from './controller';
import { Router } from 'express';
import { AuthService } from './service';
import { UserModel } from '../user/model';

const router = Router();

const authService = new AuthService(UserModel);

const authController = new AuthController(authService);

router.post('/login', authController.login);
router.get('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

export default router;
