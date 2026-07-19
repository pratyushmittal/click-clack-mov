<script>
	import { clearDisposableStorage, getDisposableStorage } from '$lib/js/storage.js';

	const threshold = 1024 ** 3;
	const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

	let { keepIds = [] } = $props();
	let bytes = $state(0);
	let clearing = $state(false);
	let error = $state('');
	let keepKey = $derived([...new Set(keepIds.filter((id) => uuidPattern.test(id)))].join(','));

	function formatBytes(value) {
		return `${(value / 1024 ** 3).toFixed(value >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
	}

	$effect(() => {
		const ids = keepKey ? keepKey.split(',') : [];
		let current = true;

		getDisposableStorage(ids)
			.then((data) => {
				if (!current) return;
				bytes = data.bytes;
				error = '';
			})
			.catch(() => {
				// Cleanup is optional, so a failed size check should not interrupt the workspace.
				if (current) bytes = 0;
			});

		return () => (current = false);
	});

	async function clearStorage() {
		const label = formatBytes(bytes);
		if (
			!confirm(
				`Clear ${label} of processed footage? Cached transcripts, camera rolls, and agent histories will be kept.`
			)
		) {
			return;
		}

		clearing = true;
		error = '';
		try {
			const ids = keepKey ? keepKey.split(',') : [];
			const result = await clearDisposableStorage(ids);
			bytes = result.bytes;
		} catch (err) {
			error = err.message || 'Could not clear processed files.';
		} finally {
			clearing = false;
		}
	}
</script>

{#if bytes > threshold}
	<div class="storage-cleanup">
		<button
			type="button"
			disabled={clearing}
			onclick={clearStorage}
			aria-label={clearing
				? 'Clearing processed files'
				: `Clear ${formatBytes(bytes)} of processed files`}
			title="Clear processed footage while keeping caches and agent histories"
		>
			<svg viewBox="0 0 64 52" aria-hidden="true">
				<path
					d="M16 43c-7 0-11-4-11-9 0-6 5-10 12-10-1-7 4-12 11-12 2-7 12-9 17-4 4 3 5 7 4 11 7 1 12 5 12 11 0 7-6 10-14 10H16Z"
				/>
				<path d="M23 29c4 2 14 2 19-1M18 37c7 3 22 3 29-1" />
			</svg>
			<span>
				{#if clearing}
					<strong>Scooping…</strong>please wait
				{:else}
					<strong>{formatBytes(bytes)}</strong>to scoop
				{/if}
			</span>
		</button>
		{#if error}<small role="alert">{error}</small>{/if}
	</div>
{/if}

<style>
	.storage-cleanup {
		display: grid;
		justify-items: end;
		margin-left: auto;
	}
	button {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--dung-line);
		border-radius: 999px;
		background: var(--surface);
		padding: 0.3rem 0.65rem 0.3rem 0.4rem;
		color: var(--dung);
		font: inherit;
		font-size: 0.66rem;
		line-height: 1.05;
		text-align: left;
		transition: 150ms ease;
	}
	button:hover:not(:disabled) {
		border-color: var(--dung);
		background: var(--white);
		transform: translateY(-1px);
	}
	button:disabled {
		cursor: wait;
		opacity: 0.55;
	}
	svg {
		width: 2.15rem;
		fill: var(--dung);
		stroke: var(--dung-dark);
		stroke-linecap: round;
		stroke-width: 2;
	}
	span {
		display: grid;
		gap: 0.12rem;
	}
	strong {
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
	small {
		max-width: 13rem;
		margin-top: 0.25rem;
		color: var(--coral-deep);
		font-size: 0.62rem;
		text-align: right;
	}
	@media (max-width: 680px) {
		button span {
			display: none;
		}
		button {
			padding: 0.25rem;
		}
	}
</style>
