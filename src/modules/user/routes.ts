import { Router } from 'express';
import { UserController } from './controller';
import { UserModel } from './model';
import { UserService } from './service';
import { authorize } from '../../middlewares/authorize';
import { PermissionPermissions, UserPermissions } from '../permission/enums';

const router = Router();

const userService = new UserService(UserModel);

const userController = new UserController(userService);

router.get('/', authorize(UserPermissions.USER_READ), userController.getAll);
router.get(
	'/roles',
	authorize(UserPermissions.USER_READ),
	userController.getRoles,
);
router.get(
	'/assignable-permissions/:userId',
	authorize(PermissionPermissions.PERMISSION_READ),
	userController.getAssignablePermissions,
);
router.post(
	'/',
	authorize(UserPermissions.USER_CREATE),
	userController.register,
);
router.post(
	'/set-permissions/:userId',
	authorize(UserPermissions.USER_UPDATE),
	userController.setPermissions,
);
router.put(
	'/:personId/:userId',
	authorize(UserPermissions.USER_UPDATE),
	userController.update,
);
router.delete(
	'/:personId',
	authorize(UserPermissions.USER_DELETE),
	userController.delete,
);

export default router;
