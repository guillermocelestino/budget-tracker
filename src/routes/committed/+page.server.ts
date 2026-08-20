import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const view = url.searchParams.get('view');
	const params = new URLSearchParams(url.searchParams);
	params.delete('view');
	const queryString = params.toString() ? `?${params.toString()}` : '';

	if (view === 'borrowed') {
		throw redirect(307, `/committed/borrowed${queryString}`);
	} else {
		throw redirect(307, `/committed/recurring${queryString}`);
	}
};
