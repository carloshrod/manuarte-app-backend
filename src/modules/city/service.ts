import { Op } from 'sequelize';
import { CityModel } from './model';
import sequelize from 'sequelize';
import { RegionModel } from '../region/model';
import { CountryModel } from '../country/model';

export class CityService {
	private cityModel;
	private regionModel;
	private countryModel;

	constructor(cityModel: typeof CityModel) {
		this.cityModel = cityModel;
		this.regionModel = RegionModel;
		this.countryModel = CountryModel;
	}

	search = async (search: string) => {
		const normalizedSearch = search
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/ñ/g, 'n');

		try {
			const cities = await this.cityModel.findAll({
				where: {
					[Op.or]: [
						sequelize.where(
							sequelize.fn(
								'unaccent',
								sequelize.fn('lower', sequelize.col('"CityModel".name')),
							),
							{
								[Op.iLike]: `%${normalizedSearch}%`,
							},
						),
						sequelize.where(
							sequelize.fn(
								'unaccent',
								sequelize.fn('lower', sequelize.col('region.name')),
							),
							{
								[Op.iLike]: `%${normalizedSearch}%`,
							},
						),
					],
				},
				attributes: [
					'id',
					'name',
					'regionId',
					[sequelize.col('region.name'), 'regionName'],
					[sequelize.col('region.country.isoCode'), 'countryIsoCode'],
				],
				include: [
					{
						model: this.regionModel,
						as: 'region',
						required: true,
						attributes: [],
						include: [
							{
								model: this.countryModel,
								as: 'country',
								attributes: [],
							},
						],
					},
				],
			});

			return {
				status: 200,
				cities,
			};
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	getById = async (id: string) => {
		try {
			const city = await CityModel.findByPk(id, {
				attributes: [
					'id',
					'name',
					[sequelize.col('region.name'), 'regionName'],
					[sequelize.col('region.country.isoCode'), 'countryIsoCode'],
				],
				include: [
					{
						model: RegionModel,
						as: 'region',
						attributes: [],
						include: [
							{
								model: CountryModel,
								as: 'country',
								attributes: [],
							},
						],
					},
				],
			});

			return city;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};
}
