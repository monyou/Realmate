import { resolve } from '$app/paths';
import { emailValidationMessage } from '#lib/auth-validation.js';

type EmailRow = {
	key: number;
	email: string;
	expanded: boolean;
	showErrors: boolean;
};

class SharingError extends Error {
	readonly status: number | undefined;

	constructor(message: string, status?: number) {
		super(message);
		this.status = status;
	}
}

const draftKey = (id: string) => `realmate-sharing-draft:${id}`;

export class ListSharingEditor {
	rows = $state<EmailRow[]>([]);
	loading = $state(false);
	saving = $state(false);
	message = $state('');
	requiresLogin = $state(false);
	draftNotSaved = $state(false);
	draftRestored = $state(false);
	loadedListId = $state<string | null>(null);

	private sequence = 0;
	private session: { id: string; controller: AbortController } | null = null;

	private fetcher: typeof fetch;

	constructor(fetcher: typeof fetch = fetch) {
		this.fetcher = fetcher;
	}

	private async request(id: string, signal: AbortSignal, options: RequestInit = {}) {
		signal.throwIfAborted();
		const controller = new AbortController();
		const abort = () => controller.abort();
		signal.addEventListener('abort', abort, { once: true });
		// Timing out one request must leave the dialog session available for retry.
		const timeout = setTimeout(() => controller.abort(), 10_000);
		try {
			const response = await this.fetcher(resolve('/api/lists/[id]/shares', { id }), {
				...options,
				cache: 'no-store',
				signal: controller.signal
			});
			if (response.status === 401) {
				throw new SharingError('Your session expired. Log in again to continue.', 401);
			}
			const result: unknown = await response.json();
			controller.signal.throwIfAborted();
			if (!response.ok) {
				if (
					result &&
					typeof result === 'object' &&
					'message' in result &&
					typeof result.message === 'string' &&
					result.message
				) {
					throw new SharingError(result.message);
				}
				throw new Error('Sharing request failed.');
			}
			return result;
		} catch (error) {
			if (!signal.aborted && controller.signal.aborted) {
				throw new SharingError('Sharing took too long to respond. Please try again.');
			}
			throw error;
		} finally {
			clearTimeout(timeout);
			signal.removeEventListener('abort', abort);
		}
	}

	canSave(id: string | undefined) {
		return Boolean(id && this.loadedListId === id && !this.loading && !this.saving);
	}

	prepareLogin() {
		if (!this.loadedListId || this.draftNotSaved) return true;
		try {
			sessionStorage.setItem(
				draftKey(this.loadedListId),
				JSON.stringify(this.rows.map((row) => row.email))
			);
			return true;
		} catch {
			this.draftNotSaved = true;
			this.message = 'Your browser could not keep these edits. Copy the emails before logging in.';
			return false;
		}
	}

	private takeDraft(id: string): string[] | null {
		try {
			const saved = sessionStorage.getItem(draftKey(id));
			if (saved === null) return null;
			const emails: unknown = JSON.parse(saved);
			sessionStorage.removeItem(draftKey(id));
			return Array.isArray(emails) && emails.every((email) => typeof email === 'string')
				? emails
				: null;
		} catch {
			return null;
		}
	}

	close() {
		this.session?.controller.abort();
		this.session = null;
		this.loadedListId = null;
		this.rows = [];
		this.loading = false;
		this.saving = false;
		this.message = '';
		this.requiresLogin = false;
		this.draftNotSaved = false;
		this.draftRestored = false;
	}

	async open(id: string) {
		this.close();
		const session = { id, controller: new AbortController() };
		this.session = session;
		this.loading = true;
		try {
			const result = await this.request(id, session.controller.signal);
			if (session.controller.signal.aborted) return;
			if (
				!result ||
				typeof result !== 'object' ||
				!('emails' in result) ||
				!Array.isArray(result.emails) ||
				!result.emails.every((email: unknown) => typeof email === 'string')
			) {
				throw new SharingError('Sharing settings could not be loaded.');
			}
			// Restore only after the server confirms this account can access the sharing settings.
			const restored = this.takeDraft(id);
			this.rows = (restored ?? result.emails).map((email: string) => ({
				key: this.sequence++,
				email,
				expanded: false,
				showErrors: false
			}));
			this.loadedListId = id;
			this.draftRestored = restored !== null;
		} catch (error) {
			if (!session.controller.signal.aborted) {
				this.requiresLogin = error instanceof SharingError && error.status === 401;
				this.message =
					error instanceof SharingError
						? error.message
						: 'Sharing settings could not be loaded. Try again.';
			}
		} finally {
			if (!session.controller.signal.aborted) this.loading = false;
		}
	}

	addEmail() {
		if (!this.canSave(this.session?.id)) return;
		this.rows.push({ key: this.sequence++, email: '', expanded: true, showErrors: false });
	}

	removeEmail(key: number) {
		if (!this.canSave(this.session?.id)) return;
		this.rows = this.rows.filter((row) => row.key !== key);
	}

	rowError(row: EmailRow) {
		const validation = emailValidationMessage(row.email);
		if (validation) return validation;
		const email = row.email.trim().toLowerCase();
		return this.rows.filter((candidate) => candidate.email.trim().toLowerCase() === email).length >
			1
			? 'This email is already in the list.'
			: '';
	}

	async save(id: string, onSaved: () => Promise<void>) {
		const session = this.session;
		if (!session || session.id !== id || !this.canSave(id)) return;
		for (const row of this.rows) {
			row.showErrors = true;
			if (this.rowError(row)) row.expanded = true;
		}
		if (this.rows.some((row) => this.rowError(row))) return;

		this.saving = true;
		this.message = '';
		this.requiresLogin = false;
		this.draftNotSaved = false;
		this.draftRestored = false;
		try {
			await this.request(id, session.controller.signal, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ emails: this.rows.map((row) => row.email.trim().toLowerCase()) })
			});
			if (session.controller.signal.aborted) return;
			await onSaved();
		} catch (error) {
			if (!session.controller.signal.aborted) {
				this.requiresLogin = error instanceof SharingError && error.status === 401;
				this.message =
					error instanceof SharingError
						? error.message
						: 'Sharing settings could not be saved. Try again.';
			}
		} finally {
			if (!session.controller.signal.aborted) this.saving = false;
		}
	}
}
