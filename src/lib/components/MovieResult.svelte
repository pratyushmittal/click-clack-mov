<script>
	import { createEditorExport, getMovieStatus } from '$lib/js/movie-maker.js';
	import { timeLabel } from '$lib/utils/time.js';

	let { result, processingSeconds, onReset } = $props();
	let exporting = $state(false);
	let exportError = $state('');
	let exportStatus = $state(null);
	let exportDownloadUrl = $state('');
	let exportSeconds = $state(0);
	let exportEvents = $derived(
		(exportStatus?.events || []).filter((event) => event.phase === 'exporting').slice(-4)
	);
	let exportMessage = $derived(
		exportStatus?.phase === 'exporting' ? exportStatus.message : 'Preparing the editable timeline'
	);

	async function exportToPremiere() {
		exporting = true;
		exportError = '';
		exportStatus = null;
		exportDownloadUrl = '';
		exportSeconds = 0;
		const startedAt = Date.now();
		const clock = setInterval(() => (exportSeconds = (Date.now() - startedAt) / 1000), 1000);
		const statusPoll = setInterval(async () => {
			try {
				exportStatus = (await getMovieStatus(result.id)).status;
			} catch {
				// A transient status read should not interrupt the export request.
			}
		}, 800);

		try {
			const data = await createEditorExport(result.id);
			exportDownloadUrl = data.downloadUrl;
			// A delayed synthetic click can be blocked after browser user activation expires.
			window.location.assign(data.downloadUrl);
		} catch (err) {
			exportError = err?.message || 'Could not create the editable project';
		} finally {
			clearInterval(clock);
			clearInterval(statusPoll);
			exporting = false;
		}
	}
</script>

<section class="result-card">
	<header>
		<div class="result-heading">
			<div>
				<p>Your first cut is ready</p>
				<h2>{result.title}</h2>
			</div>
			<span>{timeLabel(result.duration)} video · {timeLabel(processingSeconds)} processing</span>
		</div>
		<p class="summary">{result.summary}</p>
		<div class="actions">
			<a href={result.downloadUrl}
				><svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" /></svg
				>Download movie</a
			>
			<button class="export" type="button" onclick={exportToPremiere} disabled={exporting}>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"><path d="M4 4h16v16H4zM8 8h4a3 3 0 0 1 0 6H8V8zm0 6v3" /></svg
				>
				{exporting ? 'Building editable project…' : 'Export to Premiere'}
			</button>
			<button type="button" onclick={onReset} disabled={exporting}>Start another</button>
		</div>
		{#if exporting}
			<div class="export-progress" aria-live="polite">
				<div class="export-current">
					<span class="export-spinner" aria-hidden="true"></span>
					<div>
						<strong>Building your editable project</strong>
						<p>{exportMessage} · {timeLabel(exportSeconds)} elapsed</p>
					</div>
				</div>
				{#if exportEvents.length}
					<ol>
						{#each exportEvents as event, index}
							<li class:active={index === exportEvents.length - 1}>{event.message}</li>
						{/each}
					</ol>
				{/if}
			</div>
		{/if}
		{#if exportDownloadUrl}
			<div class="export-ready" role="status">
				<div>
					<strong>Editable project ready</strong>
					<p>If the download did not start automatically, download the completed package here.</p>
				</div>
				<a href={exportDownloadUrl} download="click-clack-mov-premiere.zip"
					>Download editor project</a
				>
			</div>
		{/if}
		{#if exportError}<p class="export-error" role="alert">{exportError}</p>{/if}
	</header>
	<div class="decisions">
		<h3>Edit decisions</h3>
		<div class="decision-list">
			{#each result.clips as clip, index}
				<div class="decision">
					<span class="number">{index + 1}</span>
					<div>
						<strong>{clip.fileName}</strong>
						<p>{clip.reason}</p>
					</div>
					<time>{timeLabel(clip.start)}–{timeLabel(clip.end)}</time>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.result-card {
		overflow: hidden;
		border: 1px solid rgba(36, 31, 37, 0.12);
		border-radius: 2rem;
		background: var(--surface-strong);
		box-shadow: 0 28px 90px var(--shadow);
	}
	header,
	.decisions {
		padding: clamp(1.5rem, 4vw, 2.25rem);
	}
	header {
		border-bottom: 1px solid rgba(36, 31, 37, 0.08);
		background:
			radial-gradient(circle at 92% 10%, rgba(245, 160, 133, 0.34), transparent 16rem),
			linear-gradient(145deg, rgba(217, 197, 229, 0.75), rgba(255, 253, 248, 0.92));
	}
	.result-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.25rem;
	}
	.result-heading p {
		margin: 0 0 0.55rem;
		color: var(--coral-deep);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		color: var(--ink);
		font-size: clamp(2rem, 5vw, 3.2rem);
		font-weight: 700;
		letter-spacing: -0.055em;
		line-height: 1;
	}
	.result-heading > span {
		border: 1px solid rgba(36, 31, 37, 0.1);
		border-radius: 999px;
		background: rgba(255, 253, 248, 0.7);
		padding: 0.5rem 0.8rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.67rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.summary {
		max-width: 42rem;
		margin: 1.4rem 0 0;
		color: var(--ink-soft);
		line-height: 1.7;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.75rem;
	}
	.actions a,
	.actions button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 0.9rem;
		padding: 0.8rem 1.2rem;
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
		transition: 160ms ease;
	}
	.actions a {
		border: 0;
		background: linear-gradient(145deg, var(--coral), var(--coral-deep));
		box-shadow: 0 10px 24px rgba(221, 114, 91, 0.28);
		color: var(--white);
	}
	.actions a:hover {
		transform: translateY(-2px);
		box-shadow: 0 14px 30px rgba(221, 114, 91, 0.34);
	}
	.actions svg {
		width: 1rem;
	}
	.actions button {
		border: 1px solid rgba(36, 31, 37, 0.14);
		background: rgba(255, 253, 248, 0.66);
		color: var(--ink);
	}
	.actions button:hover {
		background: var(--white);
		transform: translateY(-1px);
	}
	.actions .export {
		border-color: rgba(71, 76, 131, 0.2);
		background: linear-gradient(145deg, var(--lavender), var(--blue));
		box-shadow: 0 10px 24px rgba(71, 76, 131, 0.18);
	}
	.actions .export:hover {
		background: linear-gradient(145deg, var(--lavender), var(--blue));
		box-shadow: 0 14px 30px rgba(71, 76, 131, 0.24);
	}
	.actions button:disabled {
		cursor: wait;
		opacity: 0.65;
		transform: none;
	}
	.export-progress {
		display: grid;
		gap: 0.8rem;
		max-width: 40rem;
		margin-top: 1rem;
		border: 1px solid rgba(71, 76, 131, 0.14);
		border-radius: 1rem;
		background: rgba(255, 253, 248, 0.64);
		padding: 1rem;
	}
	.export-current {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.export-current strong {
		display: block;
		color: var(--ink);
		font-size: 0.875rem;
	}
	.export-current p {
		margin: 0.2rem 0 0;
		color: var(--ink-soft);
		font-size: 0.75rem;
	}
	.export-spinner {
		width: 1.3rem;
		height: 1.3rem;
		flex: 0 0 auto;
		border: 2px solid rgba(71, 76, 131, 0.18);
		border-top-color: var(--coral-deep);
		border-radius: 999px;
		animation: spin 800ms linear infinite;
	}
	.export-progress ol {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0 0 0 1.2rem;
		color: var(--ink-soft);
		font-size: 0.72rem;
	}
	.export-progress li.active {
		color: var(--ink);
		font-weight: 700;
	}
	.export-ready {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		max-width: 40rem;
		margin-top: 1rem;
		border: 1px solid rgba(71, 76, 131, 0.14);
		border-radius: 1rem;
		background: rgba(255, 253, 248, 0.72);
		padding: 1rem;
	}
	.export-ready strong {
		color: var(--ink);
		font-size: 0.875rem;
	}
	.export-ready p {
		margin: 0.2rem 0 0;
		color: var(--ink-soft);
		font-size: 0.75rem;
	}
	.export-ready a {
		flex: 0 0 auto;
		border-radius: 0.8rem;
		background: var(--ink);
		padding: 0.7rem 0.9rem;
		color: var(--white);
		font-size: 0.75rem;
		font-weight: 700;
		text-decoration: none;
	}
	.export-error {
		margin: 0.75rem 0 0;
		color: var(--coral-deep);
		font-size: 0.8rem;
		font-weight: 700;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	h3 {
		margin: 0 0 1rem;
		color: var(--ink);
		font-size: 1.25rem;
		letter-spacing: -0.025em;
	}
	.decision-list {
		display: grid;
		gap: 0.55rem;
	}
	.decision {
		display: grid;
		grid-template-columns: 2rem 1fr auto;
		align-items: center;
		gap: 0.8rem;
		border: 1px solid rgba(36, 31, 37, 0.09);
		border-radius: 1rem;
		background: rgba(255, 253, 248, 0.72);
		padding: 1rem;
		transition: 150ms ease;
	}
	.decision:hover {
		border-color: rgba(36, 31, 37, 0.16);
		box-shadow: 0 8px 24px rgba(66, 45, 63, 0.06);
		transform: translateY(-1px);
	}
	.number {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 0.7rem;
		background: rgba(146, 181, 199, 0.5);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.decision div {
		min-width: 0;
	}
	.decision strong {
		color: var(--ink);
		font-size: 0.875rem;
	}
	.decision p {
		margin: 0.25rem 0 0;
		color: var(--ink-soft);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	time {
		color: var(--coral-deep);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
	}
	@media (max-width: 600px) {
		.result-heading,
		.export-ready {
			display: grid;
		}
		.export-ready a {
			justify-self: start;
		}
		.result-heading > span {
			justify-self: start;
		}
		.decision {
			grid-template-columns: 2rem 1fr;
		}
		time {
			grid-column: 2;
		}
	}
</style>
