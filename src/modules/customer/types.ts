import { PersonDto } from '../person/types';

export interface CreateCustomerDto extends PersonDto {
	email: string;
	phoneNumber: string;
	city: string;
	location: string;
}

export interface UpdateCustomerDto extends CreateCustomerDto {
	personId: string;
}
