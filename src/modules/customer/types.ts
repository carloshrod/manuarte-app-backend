import { PersonDto } from '../person/types';

export interface CreateCustomerDto extends PersonDto {
	email: string;
	phoneNumber: string;
	location: string;
	city: string;
}

export interface UpdateCustomerDto extends CreateCustomerDto {
	personId: string;
}
