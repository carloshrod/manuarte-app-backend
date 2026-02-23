import axios, { AxiosError } from 'axios';
import { Handler } from 'express';
import FormData from 'form-data';

export class WhatsAppController {
	proxy: Handler = async (req, res, next) => {
		try {
			const { url, method = 'POST', data, fbToken } = req.body;

			if (!url || !url.startsWith('https://graph.facebook.com')) {
				res.status(400).json({ message: 'URL inválida' });
				return;
			}

			if (!fbToken) {
				res.status(400).json({ message: 'WhatsApp API Token requerido' });
				return;
			}

			// Si hay archivo, reenviar como multipart/form-data
			if (req.file) {
				const form = new FormData();
				// Agrega el archivo
				form.append('file', req.file.buffer, {
					filename: req.file.originalname,
					contentType: req.file.mimetype,
					knownLength: req.file.size,
				});

				form.append('messaging_product', 'whatsapp');

				const headers = {
					...form.getHeaders(),
					Authorization: `Bearer ${fbToken}`,
					'Content-Length': form.getLengthSync(), // ← CRÍTICO
				};

				try {
					const response = await axios({
						url,
						method,
						data: form,
						headers,
						maxBodyLength: Infinity,
					});

					res.status(response.status).json(response.data);
				} catch (error) {
					if (error instanceof AxiosError) {
						res
							.status(error.response?.status || 500)
							.json(error.response?.data);

						return;
					}

					// fallback para errores no axios
					console.error(error);

					res.status(500).json({
						message: 'Error interno',
					});
				}

				return;
			}

			const response = await axios({
				url,
				method,
				data,
				headers: {
					Authorization: `Bearer ${fbToken}`,
				},
			});

			res.status(response.status).json(response.data);
		} catch (error) {
			next(error);
		}
	};
}
