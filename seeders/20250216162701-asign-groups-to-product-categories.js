/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const categories = await queryInterface.sequelize.query(
			`SELECT id, name FROM product_category;`,
			{ type: Sequelize.QueryTypes.SELECT },
		);

		const categoryGroups = await queryInterface.sequelize.query(
			`SELECT id, name FROM product_category_group;`,
			{ type: Sequelize.QueryTypes.SELECT },
		);

		const groupMap = categoryGroups.reduce((acc, group) => {
			acc[group.name.toUpperCase()] = group.id;
			return acc;
		}, {});

		const categoryGroupMap = {
			'ACEITES ESENCIALES': 'ACEITES',
			'ACEITES VEGETALES': 'ACEITES',
			'BASES DE JABON DE GLICERINA': 'BASES',
			'BASES PRODUCTOS DE CUIDADO PERSONAL': 'BASES',
			'CERAS / PARAFINAS /ADITIVOS': 'CERAS',
			'COLORANTES PARA JABONES': 'COLORANTES',
			'COLORANTES PARA VELAS': 'COLORANTES',
			'ENVASES DE VIDRIO': 'ENVASES',
			'ENVASES DE YESO (PARA MACETAS O VELAS)': 'ENVASES',
			'ENVASES PLASTICOS': 'ENVASES',
			'EXTRACTOS NATURALES': 'EXTRACTOS',
			'FRAGANCIAS JABONES / VELAS / CUIDADO PERSONAL': 'FRAGANCIAS',
			'GEL PARA VELAS': 'GELES',
			'INGREDIENTES ACTIVOS / INSUMOS / ADORNOS': 'INGREDIENTES',
			'MECHAS/PABILOS - PORTAMECHAS': 'MECHAS',
			MICAS: 'MICAS',
			'MOLDES PARA JABONES': 'MOLDES',
			'MOLDES PARA VELAS': 'MOLDES',
			'MOLDES VARIOS': 'MOLDES',
			UTENSILIOS: 'UTENSILIOS',
			'VARIOS / PRODUCTOS QUIMICOS': 'VARIOS',
		};

		const updates = categories
			.map(category => {
				const groupName = categoryGroupMap[category.name.toUpperCase()];
				const groupId = groupMap[groupName];

				if (groupId) {
					return {
						id: category.id,
						productCategoryGroupId: groupId,
					};
				}
				return null;
			})
			.filter(Boolean);

		for (const update of updates) {
			await queryInterface.bulkUpdate(
				'product_category',
				{ productCategoryGroupId: update.productCategoryGroupId },
				{ id: update.id },
			);
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkUpdate(
			'product_category',
			{ productCategoryGroupId: null },
			{},
		);
	},
};
