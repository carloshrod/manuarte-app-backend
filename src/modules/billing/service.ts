import { BillingModel } from './model';

export class BillingService {
	private billingModel;

	constructor(billingModel: typeof BillingModel) {
		this.billingModel = billingModel;
	}
}
