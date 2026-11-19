/** The error for a failed response: the server's own `message` when it sent one, else the status. */
async function failure(response: Response, label: string): Promise<Error> {
	const body = (await response.json().catch(() => null)) as { message?: string } | null;
	return new Error(body?.message ?? `${label} failed (${response.status})`);
}

export async function getJson<R>(url: string, label: string, signal?: AbortSignal): Promise<R> {
	const response = await fetch(url, { signal });
	if (!response.ok) throw await failure(response, label);
	return (await response.json()) as R;
}

export async function postJson<R>(
	url: string,
	body: unknown,
	label: string,
	signal?: AbortSignal
): Promise<R> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});
	if (!response.ok) throw await failure(response, label);
	return (await response.json()) as R;
}
