import axiosClient from '@/core/axios/config';

/** Download through the current dashboard or portal authentication scope. */
export async function downloadInvoicePdf(path: string, invoiceLabel: string): Promise<void> {
	let pdf: Blob;
	try {
		pdf = await axiosClient.get<Blob, Blob>(path, {
			responseType: 'blob',
			headers: { Accept: 'application/pdf' },
		});
	} catch (error) {
		// Axios also receives error bodies as blobs for binary requests. Keep their
		// human-readable message without downloading a JSON error as an invoice.
		if (error instanceof Blob) {
			const body = await error
				.text()
				.then((text) => JSON.parse(text) as { message?: unknown; error?: unknown })
				.catch(() => null);
			const message = body?.message ?? body?.error;
			throw new Error(typeof message === 'string' ? message : 'Unable to download this invoice PDF. Please try again.');
		}
		throw error;
	}
	if (!(pdf instanceof Blob) || pdf.size === 0 || pdf.type.split(';')[0]?.toLowerCase() !== 'application/pdf') {
		throw new Error('The server did not return an invoice PDF. Please try again.');
	}

	const url = URL.createObjectURL(pdf);
	const link = document.createElement('a');
	link.href = url;
	link.download = `invoice-${invoiceLabel.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)}.pdf`;
	try {
		document.body.appendChild(link);
		link.click();
	} finally {
		link.remove();
		// Leave time for the browser to consume the object URL before revoking it.
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
}
