import { PersonDto } from '../person/types';

export interface CreateCustomerDto extends PersonDto {
	email: string;
	phoneNumber: string;
	location: string;
	cityId: string;
	customerId?: string;
	personId?: string;
}

export type UpdateCustomerDto = CreateCustomerDto;

export interface CountryCount {
	countryName: string;
	countryIsoCode: string;
	customerCount: number;
}
