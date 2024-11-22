import { BillingItemService } from './../billing-item/service';
import { Handler } from 'express';
import { BillingService } from './service';
import { BillingItemModel } from '../billing-item/model';

export class BillingController {
	private billingService;
	private billingItemService;

	constructor(billingService: BillingService) {
		this.billingService = billingService;
		this.billingItemService = new BillingItemService(BillingItemModel);
	}
}
