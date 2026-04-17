import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

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

const PDFTermsCol = () => {
	const BRANCHES: Record<
		string,
		{ address: string; phoneNumber: string; email: string }
	> = {
		barranquilla: {
			address: 'Carrera 44 # 72 - 107, Local 105 - Edif. Nueva Colombia',
			phoneNumber: '322 887 3928',
			email: 'ventascolombia@manuartestore.com',
		},
		cartagena: {
			address: 'Calle 30 (Av. Consulado) # 62 - 23',
			phoneNumber: '312 388 3602',
			email: 'info@manuartestore.com',
		},
	};

	const branch = BRANCHES.barranquilla;

	return (
		<View style={styles.container}>
			<Text style={styles.title}>
				TERMINOS Y CONDICIONES – POR FAVOR LEA ESTO
			</Text>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Los pedidos nacionales se envían desde nuestra bodega en Barranquilla
					entre{' '}
					<Text style={styles.bold}>
						24 y 72 horas después de confirmado el pago Total del pedido
					</Text>
					.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={[styles.listItemText, styles.bold]}>
					EL TIEMPO QUE TARDE EN LLEGAR EL PEDIDO AL CLIENTE ES RESPONSABILIDAD
					DE LA TRANSPORTADORA, NO DE MANUARTE
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Todos los costos de envíos corren{' '}
					<Text style={styles.bold}>por cuenta del cliente</Text> (incluso el
					envío de muestras). Nuestros precios{' '}
					<Text style={styles.bold}>NO INCLUYEN EL ENVIO</Text>.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Los envíos se hacen a través de la transportadora{' '}
					<Text style={styles.bold}>ENVIA quienes son los responsables</Text> de
					transportar el paquete desde nuestras instalaciones hasta el lugar
					indicado por el cliente.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Si el cliente solicita se le despache por otra operadora, habrá un
					recargo extra al pedido.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Manuarte Colombia no se hace responsable por daños o pérdidas de la
					mercadería ocasionados por el transportista. Le corresponde al cliente
					revisar la mercadería en presencia del transportista y verificar el
					contenido de lo recibido.{' '}
					<Text style={styles.bold}>
						Cualquier reclamo por mala manipulación, deterioro, faltantes,
						derrames, retraso en la entrega
					</Text>{' '}
					u otro factor relacionado con el transporte del paquete,{' '}
					<Text style={styles.bold}>
						deberá ser presentado al transportista y NO A MANUARTE
					</Text>
					.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					No se harán reembolsos, ni se aceptarán devoluciones. Todos los gastos
					que se generen para cambios de productos correrán por cuenta del
					cliente, exceptuando los casos en que la responsabilidad de dicho
					cambio sea reconocida como nuestra.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Antes de comprar cualquiera de nuestros productos, asegúrese de que el
					mismo cumple con sus requerimientos y que es acorde a lo que necesita.
					Solicite una muestra (si es posible se la suministraremos para que
					haga las pruebas respectivas) o compre la cantidad mínima y evalúe
					nuestro producto antes de hacer una compra considerable, ya que{' '}
					<Text style={styles.bold}>
						no se aceptan devoluciones ni se reembolsan valores
					</Text>
					.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Manuarte Colombia vende insumos y proporciona fichas técnicas o guías
					de proceso si estuviesen disponibles, sin embargo, no estamos
					obligados a dar formulaciones o enseñar a usar dichos productos. Es
					responsabilidad del cliente investigar y conocer cómo usarlos. Nos
					deslindamos de la responsabilidad por el mal uso dado a los productos
					o la no obtención de los resultados esperados.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Para productos que se venden{' '}
					<Text style={styles.bold}>
						solo bajo pedido, el tiempo mínimo estimado para entregarle al
						cliente, será de 15 días a partir del pago
					</Text>
					. Este tiempo pudiera extenderse por motivos ajenos a nosotros. El
					cliente se obliga a recibir el(los) producto(s) una vez esté(n)
					disponible(s) para su entrega.
				</Text>
			</View>

			<View style={styles.listItem} wrap={false}>
				<Text style={{ width: 10 }}>•</Text>
				<Text style={styles.listItemText}>
					Se da por entendido que el cliente al realizar el pago de este pedido
					acepta los términos y condiciones aquí expuestas.
				</Text>
			</View>

			<View style={styles.my4}>
				<Text style={styles.italic}>
					Favor realizar pago o transferencia según el adjunto que se le envía
					donde constan los medios de pago y las consideraciones que debe tener
					en cuenta según el medio de pago que elija.
				</Text>
				<Text style={styles.italic}>
					Si desea cancelar con tarjeta de crédito, haga la compra en
					www.manuartestore.com
				</Text>
				<Text style={[styles.italic, styles.bold]}>
					Manuarte Colombia S.A.S. - Sede Barranquilla
				</Text>
			</View>

			<View style={styles.blueText}>
				<Text>{branch?.address}</Text>
				<Text>
					Tel: {branch?.phoneNumber} | E-mail: {branch?.email}
				</Text>
				<Text>Facebook: Manuarte Colombia</Text>
			</View>
		</View>
	);
};

export default PDFTermsCol;
