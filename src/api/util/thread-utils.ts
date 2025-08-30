import { Channel, Message } from "@spacebar/util";

export async function computeLastActivityAt(thread: Channel): Promise<Date> {
	if (thread.last_message_id) {
		const msg = await Message.findOne({
			where: { id: thread.last_message_id },
		});
		if (msg?.timestamp) return msg.timestamp;
	}
	return thread.created_at;
}

export function isActiveThread(
	durationSec: number | null | undefined,
	inactivityMs: number,
): boolean {
	if (!durationSec && durationSec !== 0) durationSec = 86400;
	if (durationSec === 0) return true;
	return inactivityMs < durationSec * 1000;
}

export function isArchivedThread(
	durationSec: number | null | undefined,
	inactivityMs: number,
): boolean {
	if (!durationSec && durationSec !== 0) durationSec = 86400;
	if (durationSec === 0) return false;
	return inactivityMs >= durationSec * 1000;
}

export async function listArchivedThreadsFor(
	threads: Channel[],
	before: string | undefined,
	limit: number,
): Promise<{ threads: Channel[]; has_more: boolean }> {
	const now = Date.now();
	const withActivity = await Promise.all(
		threads.map(async (t) => {
			const lastAt = await computeLastActivityAt(t);
			return { t, lastAt, inactivityMs: now - lastAt.getTime() };
		}),
	);

	let archived = withActivity
		.filter(({ t, inactivityMs }) =>
			isArchivedThread(t.default_auto_archive_duration, inactivityMs),
		)
		.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

	if (before) {
		const beforeTs = Number.isNaN(Number(before))
			? Date.parse(before)
			: Number(before);
		if (!Number.isNaN(beforeTs)) {
			archived = archived.filter((x) => x.lastAt.getTime() < beforeTs);
		}
	}

	const page = archived.slice(0, limit).map((x) => x.t);
	const has_more = archived.length > page.length;

	return { threads: page, has_more };
}
