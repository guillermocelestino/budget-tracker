import type { LayoutServerLoad } from './$types';
import { loadCommittedWorkspaceData } from '$lib/server/services/committedWorkspaceLoad';

export const load: LayoutServerLoad = async ({ url, locals }) => {
	const isBorrowed = url.pathname.includes('/borrowed');
	return loadCommittedWorkspaceData({
		url,
		locals,
		defaultView: isBorrowed ? 'borrowed' : 'recurring'
	});
};
