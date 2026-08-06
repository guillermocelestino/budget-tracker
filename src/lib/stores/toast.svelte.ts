export type ToastType = 'success' | 'error' | 'info';

/** Optional action CTA rendered inside a toast (e.g. "Open Recurring"). */
export type ToastAction = { label: string; href: string };

export interface ToastItem {
	id: number;
	type: ToastType;
	message: string;
	duration: number;
	action?: ToastAction;
}

let nextId = 0;

export const toastState = $state<{ items: ToastItem[] }>({ items: [] });

export function addToast(type: ToastType, message: string, duration = 4000, action?: ToastAction): void {
	const id = nextId++;
	toastState.items = [...toastState.items, { id, type, message, duration, action }];

	if (duration > 0) {
		setTimeout(() => {
			toastState.items = toastState.items.filter((t) => t.id !== id);
		}, duration);
	}
}

export function dismissToast(id: number): void {
	toastState.items = toastState.items.filter((t) => t.id !== id);
}

export function showSuccess(message: string, duration?: number, action?: ToastAction): void {
	addToast('success', message, duration, action);
}

export function showError(message: string, duration?: number, action?: ToastAction): void {
	addToast('error', message, duration, action);
}

export function showInfo(message: string, duration?: number, action?: ToastAction): void {
	addToast('info', message, duration, action);
}
