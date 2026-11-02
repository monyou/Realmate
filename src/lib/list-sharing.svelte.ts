import { resolve } from '$app/paths';
import { emailValidationMessage } from '#lib/auth-validation.js';

type EmailRow = {
	key: number;
	email: string;
	expanded: boolean;
	showErrors: boolean;
};

class SharingError extends Error {}

export class ListSharingEditor {
	rows = $state<EmailRow[]>([]);
	loading = $state(false);
	saving = $state(false);
	message = $state('');
	loadedListId = $state<string | null>(null);

	private sequence = 0;
	private session: { id: string; controller: AbortController } | null = null;

	private fetcher: typeof fetch;

	constructor(fetcher: typeof fetch = fetch) {
		this.fetcher = fetcher;
	}

	canSave(id: string | undefined) {
		return Boolean(id && this.loadedListId === id && !this.loading && !this.saving);
	}

	close() {
		this.session?.controller.abort();
		this.session = null;
		this.loadedListId = null;
		this.rows = [];
		this.loading = false;
		this.saving = false;
		this.message = '';
	}

	async open(id: string) {
		this.close();
		const session = { id, controller: new AbortController() };
		this.session = session;
		this.loading = true;
		try {
			const response = await this.fetcher(resolve('/api/lists/[id]/shares', { id }), {
				signal: session.controller.signal,
				cache: 'no-store'
			});
			const result = await response.json();
			if (session.controller.signal.aborted) return;
			if (!response.ok)
				throw new SharingError(result.message || 'Sharing settings could not be loaded.');
			if (
				!Array.isArray(result.emails) ||
				!result.emails.every((email: unknown) => typeof email === 'string')
			) {
				throw new SharingError('Sharing settings could not be loaded.');
			}
			this.rows = result.emails.map((email: string) => ({
				key: this.sequence++,
				email,
				expanded: false,
				showErrors: false
			}));
			this.loadedListId = id;
		} catch (error) {
			if (!session.controller.signal.aborted) {
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
		try {
			const response = await this.fetcher(resolve('/api/lists/[id]/shares', { id }), {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ emails: this.rows.map((row) => row.email.trim().toLowerCase()) }),
				signal: session.controller.signal
			});
			const result = await response.json();
			if (session.controller.signal.aborted) return;
			if (!response.ok)
				throw new SharingError(result.message || 'Sharing settings could not be saved.');
			await onSaved();
		} catch (error) {
			if (!session.controller.signal.aborted) {
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
