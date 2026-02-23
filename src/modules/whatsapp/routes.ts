import { Router } from 'express';
import { WhatsAppController } from './controller';
import multer from 'multer';

const router = Router();

const upload = multer({
	storage: multer.memoryStorage(),
});

const whatsAppController = new WhatsAppController();

router.post('/', upload.single('file'), whatsAppController.proxy);

export default router;
