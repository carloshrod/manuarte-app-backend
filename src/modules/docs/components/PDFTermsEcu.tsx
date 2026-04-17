import React from 'react';
import { Text, View, StyleSheet, Link } from '@react-pdf/renderer';

const styles = StyleSheet.create({
	container: {
		display: 'flex',
		flexDirection: 'column',
		gap: 6,
		lineHeight: 1.5,
		fontSize: 10,
	},
	title: {
		textAlign: 'center',
		fontSize: 14,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	listItem: { display: 'flex', flexDirection: 'row' },
	listItemText: {
		marginBottom: 6,
	},
	bold: {
		fontWeight: 'bold',
	},
	italic: {
		fontStyle: 'italic',
	},
	my4: {
		display: 'flex',
		flexDirection: 'column',
		gap: 6,
		marginTop: 12,
		marginBottom: 12,
	},
	blueText: {
		color: '#3B82F6',
		textAlign: 'center',
		marginTop: 12,
	},
	contact: {
		textAlign: 'center',
	},
});

const PDFTermsEcu = () => (
	<View style={styles.container}>
		<Text style={styles.title}>
			TERMINOS Y CONDICIONES – POR FAVOR LEA ESTO
		</Text>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={[styles.listItemText, styles.bold]}>
				EL PRECIO DE ACEITES ESENCIALES, VEGETALES O EXTRACTOS PUEDE VARIAR SIN
				PREVIO AVISO.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Todos los costos de envíos corren por cuenta del cliente. Manuarte
				Ecuador no será responsable por daños o pérdidas de la mercadería
				ocasionados por el transportista. Le corresponde al Cliente revisar la
				mercadería en presencia del transportista y verificar el contenido de lo
				recibido.{' '}
				<Text style={styles.bold}>
					Cualquier reclamo por mala manipulación, deterioro, faltantes,
					derrames o retraso en la entrega deberá ser presentado al
					Transportista y NO A MANUARTE
				</Text>
				.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				No se harán reembolsos, ni se aceptarán devoluciones. Todos los gastos
				de fletes para cambios de productos corren por cuenta del cliente,
				exceptuando los casos en que la responsabilidad de dicho cambio sea
				reconocida como nuestra.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Todos los productos se envían a través de{' '}
				<Text style={styles.bold}>SERVIENTREGA</Text>. Si el cliente desea que
				se despache por otra operadora, habrá un recargo extra a la cotización.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Antes de comprar cualquiera de nuestros productos, asegúrese de que el
				mismo cumple con sus requerimientos y que es acorde a lo que usted
				necesita. Solicite una muestra (si es posible se la suministraremos para
				que haga pruebas) o compre la cantidad mínima y evalúe nuestro producto
				antes de hacer una compra considerable ya que no se aceptan devoluciones
				ni se reembolsan valores.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Manuarte Ecuador vende insumos y proporciona las fichas técnicas o guías
				de proceso si estuviesen disponibles, sin embargo, no estamos obligados
				a dar formulaciones o enseñar a usar dichos productos.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Es responsabilidad del cliente investigar y conocer cómo usarlos. Nos
				deslindamos de la responsabilidad por el mal uso dado a los productos o
				la no obtención de los resultados esperados.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Para productos que se venden{' '}
				<Text style={styles.bold}>
					solo bajo pedido, el tiempo mínimo estimado para entregar al cliente
					será de 15 días a partir del pago
				</Text>
				, pudiendo este tiempo extenderse por motivos ajenos a nosotros. El
				cliente se obliga a recibir el(los) producto(s) una vez están
				disponibles en nuestro almacén en Quito.
			</Text>
		</View>

		<View style={styles.listItem} wrap={false}>
			<Text style={{ width: 10 }}>•</Text>
			<Text style={styles.listItemText}>
				Se da por entendido que el Cliente al realizar el pago de esta
				cotización acepta los términos aquí expuestos.
			</Text>
		</View>

		<View style={styles.my4}>
			<Text style={styles.italic}>
				Favor realizar deposito o transferencia a: Cta. De Ahorros Banco
				Pichincha 2201295875 a nombre de Ricardo Teran Carrillo. C.I.
				171469833-7. E-mail: gerencia@manuartestore.com
			</Text>
			<Text style={styles.italic}>
				Si desea cancelar con tarjeta de crédito, haga la compra en
				www.manuartestore.com
			</Text>
			<Text style={[styles.italic, styles.bold]}>Manuarte Ecuador S.A.S.</Text>
		</View>

		<View style={styles.blueText}>
			<Text>Ulloa N26 – 130 y Vicente Aguirre, Quito – Ecuador</Text>
			<Text>
				Teléfono: 099 8916972 | E-mail: adminecuador@manuartestore.com
			</Text>
			<Link
				src="https://www.manuartestore.com"
				style={{ color: '#3B82F6', textDecoration: 'none' }}
			>
				www.manuartestore.com
			</Link>
		</View>
	</View>
);

export default PDFTermsEcu;
