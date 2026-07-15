<script>
	let { result, onReset } = $props();
	function timeLabel(seconds) {
		const minutes = Math.floor(seconds / 60);
		return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
	}
</script>

<section class="result-card">
	<header>
		<div class="result-heading">
			<div>
				<p>Your first cut is ready</p>
				<h2>{result.title}</h2>
			</div>
			<span>{timeLabel(result.duration)}</span>
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
			<button type="button" onclick={onReset}>Start another</button>
		</div>
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
		border: 1px solid var(--ink-800);
		border-radius: 2rem;
		background: var(--ink-900);
		box-shadow: 0 24px 80px rgba(4, 4, 12, 0.45);
	}
	header,
	.decisions {
		padding: clamp(1.5rem, 4vw, 2rem);
	}
	header {
		border-bottom: 1px solid var(--ink-800);
	}
	.result-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.25rem;
	}
	.result-heading p {
		margin: 0 0 0.5rem;
		color: var(--lime-400);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		color: var(--ink-50);
		font-family: 'Space Grotesk', sans-serif;
		font-size: clamp(1.8rem, 4vw, 2.4rem);
		letter-spacing: -0.04em;
	}
	.result-heading > span {
		border-radius: 999px;
		background: var(--lime-400);
		padding: 0.45rem 0.75rem;
		color: var(--ink-950);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.summary {
		max-width: 42rem;
		margin: 1.5rem 0 0;
		color: var(--ink-300);
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
		border-radius: 999px;
		padding: 0.8rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
	}
	.actions a {
		background: var(--lime-400);
		color: var(--ink-950);
	}
	.actions a:hover {
		background: var(--lime-300);
	}
	.actions svg {
		width: 1rem;
	}
	.actions button {
		border: 1px solid var(--ink-700);
		background: transparent;
		color: var(--ink-200);
	}
	.actions button:hover {
		border-color: var(--ink-500);
		background: var(--ink-800);
	}
	h3 {
		margin: 0 0 1rem;
		color: var(--ink-100);
		font-family: 'Space Grotesk', sans-serif;
	}
	.decision-list {
		display: grid;
		gap: 0.5rem;
	}
	.decision {
		display: grid;
		grid-template-columns: 2rem 1fr auto;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid var(--ink-800);
		border-radius: 1rem;
		background: rgba(11, 11, 22, 0.6);
		padding: 1rem;
	}
	.number {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 999px;
		background: var(--violet-950);
		color: var(--violet-300);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
	}
	.decision div {
		min-width: 0;
	}
	.decision strong {
		color: var(--ink-100);
		font-size: 0.875rem;
	}
	.decision p {
		margin: 0.25rem 0 0;
		color: var(--ink-400);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	time {
		color: var(--lime-400);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
	}
	@media (max-width: 600px) {
		.decision {
			grid-template-columns: 2rem 1fr;
		}
		time {
			grid-column: 2;
		}
	}
</style>
