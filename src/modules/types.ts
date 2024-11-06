import { CreateOptions } from 'sequelize';

export interface CustomCreateOptions extends CreateOptions {
	submittedBy?: string;
}
