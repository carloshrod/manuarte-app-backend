import { Router } from 'express';
import { UserController } from './controller';
import { UserModel } from './model';
import { UserService } from './service';

const router = Router();

const userService = new UserService(UserModel);

const userController = new UserController(userService);

router.get('/', userController.getAll);
router.get('/roles', userController.getRoles);
router.post('/', userController.register);
router.put('/:personId/:userId', userController.update);
router.delete('/:personId', userController.delete);

export default router;
