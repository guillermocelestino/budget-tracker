import { computeNetWorth } from '$lib/server/networth';

export async function load({ locals }: { locals: App.Locals }) {
	const userId = locals.user!.userId;
	const netWorth = await computeNetWorth(userId);
	return { netWorth };
}
