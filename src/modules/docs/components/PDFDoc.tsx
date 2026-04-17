import React from 'react';
import path from 'path';
import fs from 'fs';
import {
	Document,
	Page,
	Text,
	View,
	Image,
	StyleSheet,
} from '@react-pdf/renderer';
import PDFTable from './PDFTable';
import PDFTermsCol from './PDFTermsCol';
import PDFTermsEcu from './PDFTermsEcu';
import {
	formatDate,
	formatToTitleCase,
	BILLING_STATUS_MAP,
	PAYMENT_METHOD_MAP,
	DiscountType,
} from '../utils';
import { BillingStatus } from '../../billing/types';

const LOGO_MANUARTE = `data:image/png;base64,${fs
	.readFileSync(
		path.resolve(__dirname, '../../../../src/assets/logo-manuarte.png'),
	)
	.toString('base64')}`;
const LOGO_EASY_SOAP = `data:image/jpeg;base64,${fs
	.readFileSync(
		path.resolve(__dirname, '../../../../src/assets/logo-easy-soap.jpg'),
	)
	.toString('base64')}`;

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontSize: 10,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 10,
		marginBottom: 20,
	},
	logo: {
		width: 100,
		height: 50,
	},
	title: {
		flexDirection: 'row',
		alignItems: 'center',
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 20,
	},
	notPaid: {
		flexDirection: 'row',
		alignItems: 'center',
		color: '#dc2626',
		padding: 2,
		border: '2px solid #dc2626',
		borderRadius: 4,
	},
	docDetails: {
		display: 'flex',
		flexDirection: 'column',
		marginBottom: 30,
		borderTop: '1px solid #ececec',
		borderLeft: '1px solid #ececec',
	},
	docDetailsRow: {
		display: 'flex',
		flexDirection: 'row',
	},
	docDetailsRowLabel: {
		width: '30%',
		fontWeight: 600,
		padding: 10,
		borderBottom: '1px solid #ececec',
		borderRight: '1px solid #ececec',
	},
	docDetailsRowValue: {
		width: '70%',
		padding: 10,
		borderBottom: '1px solid #ececec',
		borderRight: '1px solid #ececec',
	},
});

type Item = {
	id?: string | number;
	name: string;
	quantity: number | string;
	price: number | string;
	totalPrice: number | string;
};

export type DocData = {
	serialNumber: string;
	status: BillingStatus;
	fullName?: string;
	dni?: string;
	phoneNumber?: string;
	location?: string;
	cityName?: string;
	city?: string;
	countryIsoCode?: string;
	createdDate?: Date | string;
	discountType?: DiscountType | null;
	discount?: number | string | null;
	shipping?: number | string | null;
	items?: Item[];
	paymentMethods?: string[];
};

type Props = {
	isQuote: boolean;
	data: DocData;
};

const PDFDoc = ({ isQuote, data }: Props) => {
	const isNotPaid = !isQuote && data?.status !== BillingStatus.PAID;

	return (
		<Document>
			<Page size="A4" style={styles.page} wrap>
				{/* Header */}
				<View style={styles.header}>
					<View>
						<Image src={LOGO_MANUARTE} style={styles.logo} />
						<Text>www.manuartestore.com</Text>
					</View>
					<Image src={LOGO_EASY_SOAP} style={{ width: 150, height: 60 }} />
				</View>

				{/* Title */}
				<View style={styles.title}>
					<Text>
						{isQuote ? 'Cotización' : 'Factura'} #{data?.serialNumber}{' '}
					</Text>
					{isNotPaid && (
						<View style={styles.notPaid}>
							<Text>{BILLING_STATUS_MAP[data?.status]}</Text>
						</View>
					)}
				</View>

				{/* Doc Details */}
				<View style={styles.docDetails}>
					<View style={styles.docDetailsRow}>
						<Text style={styles.docDetailsRowLabel}>Cliente:</Text>
						<Text style={styles.docDetailsRowValue}>
							{formatToTitleCase(data?.fullName ?? '') || 'Consumidor Final'}
						</Text>
					</View>

					<View style={styles.docDetailsRow}>
						<Text style={styles.docDetailsRowLabel}>Documento:</Text>
						<Text style={styles.docDetailsRowValue}>{data?.dni || 'NA'}</Text>
					</View>

					<View style={styles.docDetailsRow}>
						<Text style={styles.docDetailsRowLabel}>Teléfono:</Text>
						<Text style={styles.docDetailsRowValue}>
							{data?.phoneNumber || 'NA'}
						</Text>
					</View>

					<View style={styles.docDetailsRow}>
						<Text style={styles.docDetailsRowLabel}>Dirección:</Text>
						<Text style={styles.docDetailsRowValue}>
							{formatToTitleCase(data?.location ?? '') || 'NA'}
						</Text>
					</View>

					<View style={styles.docDetailsRow}>
						<Text style={styles.docDetailsRowLabel}>Ciudad:</Text>
						<Text style={styles.docDetailsRowValue}>
							{formatToTitleCase(data?.cityName ?? '') ||
								formatToTitleCase(data?.city ?? '') ||
								'NA'}
						</Text>
					</View>

					<View style={styles.docDetailsRow}>
						<Text style={styles.docDetailsRowLabel}>Fecha:</Text>
						<Text style={styles.docDetailsRowValue}>
							{formatDate(data?.createdDate ?? '')}
						</Text>
					</View>

					{!isQuote && (data?.paymentMethods?.length ?? 0) > 0 && (
						<View style={styles.docDetailsRow}>
							<Text style={styles.docDetailsRowLabel}>Métodos de pago:</Text>
							<Text style={styles.docDetailsRowValue}>
								{data.paymentMethods
									?.map(p => {
										const paymentMethod = p.includes('TRANSFER')
											? 'Transferencia'
											: PAYMENT_METHOD_MAP[
													p as keyof typeof PAYMENT_METHOD_MAP
												];
										return formatToTitleCase(paymentMethod ?? '');
									})
									.join(', ')}
							</Text>
						</View>
					)}
				</View>

				{/* Table */}
				{(data?.items?.length ?? 0) > 0 && <PDFTable data={data} />}

				{/* Terms */}
				{data?.countryIsoCode === 'CO' ? <PDFTermsCol /> : <PDFTermsEcu />}
			</Page>
		</Document>
	);
};

export default PDFDoc;
