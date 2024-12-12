import { PersonDto } from '../person/types';

export interface CreateUserDto extends PersonDto {
	roleId: string;
	email: string;
	password: string;
}

export interface UpdateUserDto extends CreateUserDto {
	personId: string;
	userId: string;
}

export interface SetPermissionsDto {
	userId: string;
	extraPermissions: string[];
}
