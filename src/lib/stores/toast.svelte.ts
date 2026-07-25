export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
	id: number;
	type: ToastType;
	message: string;
	duration: number;
}

let nextId = 0;

export const toastState = $state<{ items: ToastItem[] }>({ items: [] });

export function addToast(type: ToastType, message: string, duration = 4000): void {
	const id = nextId++;
	toastState.items = [...toastState.items, { id, type, message, duration }];

	if (duration > 0) {
		setTimeout(() => {
			toastState.items = toastState.items.filter((t) => t.id !== id);
		}, duration);
	}
}

export function dismissToast(id: number): void {
	toastState.items = toastState.items.filter((t) => t.id !== id);
}

export function showSuccess(message: string, duration?: number): void {
	addToast('success', message, duration);
}

export function showError(message: string, duration?: number): void {
	addToast('error', message, duration);
}

export function showInfo(message: string, duration?: number): void {
	addToast('info', message, duration);
}
