import { PersonDto } from '../person/types';

export interface CreateCustomerDto extends PersonDto {
	email: string;
	phoneNumber: string;
	location: string;
	city: string;
	customerId?: string;
	personId?: string;
}

export type UpdateCustomerDto = CreateCustomerDto;
