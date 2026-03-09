import { Router } from 'express';
import { WhatsAppAgentService } from './service';
import { WhatsAppAgentController } from './controller';

const router = Router();

const whatsAppAgentService = new WhatsAppAgentService();
const whatsAppAgentController = new WhatsAppAgentController(
	whatsAppAgentService,
);

router.get('/webhook', whatsAppAgentController.verifyWebhook);
router.post('/webhook', whatsAppAgentController.receiveMessage);

export default router;
