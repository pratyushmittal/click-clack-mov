<script>
	let { result, processingSeconds, onReset } = $props();
	function timeLabel(seconds) {
		const total = Math.round(seconds);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const remainingSeconds = total % 60;
		return hours
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
			: `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
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
		border: 3px solid var(--ink);
		border-radius: 1.7rem 2.1rem 1.6rem 2.2rem;
		background: var(--paper);
		box-shadow: 9px 11px 0 rgba(36, 31, 37, 0.12);
	}
	header,
	.decisions {
		padding: clamp(1.5rem, 4vw, 2rem);
	}
	header {
		border-bottom: 2px solid var(--ink);
		background: linear-gradient(150deg, var(--lavender), #eadff0);
	}
	.result-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.25rem;
	}
	.result-heading p {
		margin: 0 0 0.5rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.5rem);
		font-weight: 400;
	}
	.result-heading > span {
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--mustard);
		padding: 0.45rem 0.75rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
	}
	.summary {
		max-width: 42rem;
		margin: 1.35rem 0 0;
		color: var(--ink-soft);
		line-height: 1.7;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.6rem;
	}
	.actions a,
	.actions button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 2px solid var(--ink);
		border-radius: 0.85rem 1rem 0.8rem 1.1rem;
		padding: 0.75rem 1.15rem;
		font-size: 0.875rem;
		font-weight: 700;
		text-decoration: none;
	}
	.actions a {
		background: var(--coral);
		box-shadow: 3px 3px 0 var(--ink);
		color: var(--ink);
	}
	.actions a:hover {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.actions svg {
		width: 1rem;
	}
	.actions button {
		background: var(--paper);
		color: var(--ink);
	}
	.actions button:hover {
		background: var(--mustard-light);
	}
	h3 {
		margin: 0 0 1rem;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
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
		border: 1.5px solid var(--ink);
		border-radius: 0.85rem 1rem 0.8rem 1.05rem;
		background: var(--white);
		padding: 1rem;
	}
	.number {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--blue);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.7rem;
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
		font-size: 0.72rem;
		font-weight: 700;
	}
	@media (max-width: 600px) {
		.result-heading {
			display: grid;
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
