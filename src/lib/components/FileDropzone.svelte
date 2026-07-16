<script>
	let { files, onAdd, onRemove } = $props();
	let input;
	let dragging = $state(false);

	function addFiles(fileList) {
		onAdd([...fileList].filter((file) => file.type.startsWith('video/')));
	}

	function onDrop(event) {
		event.preventDefault();
		dragging = false;
		addFiles(event.dataTransfer.files);
	}

	function sizeLabel(bytes) {
		return bytes > 1024 * 1024 * 1024
			? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
			: `${(bytes / 1024 / 1024).toFixed(0)} MB`;
	}

	function durationLabel(seconds) {
		if (!Number.isFinite(seconds)) return 'Reading duration…';
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return hours
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
			: `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
	}
</script>

<section class="footage-section">
	<button
		type="button"
		class:dragging
		class="dropzone"
		onclick={() => input.click()}
		ondragenter={(event) => {
			event.preventDefault();
			dragging = true;
		}}
		ondragover={(event) => event.preventDefault()}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		<span class="dropzone-glow"></span>
		<span class="upload-icon">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				aria-hidden="true"
			>
				<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
			</svg>
		</span>
		<strong>Drop your footage here</strong>
		<small
			>Drag in your raw clips, or click to browse. MP4, MOV, WebM and other common video formats.</small
		>
		<em>No fixed video limit</em>
	</button>

	<input
		bind:this={input}
		class="file-input"
		type="file"
		accept="video/*"
		multiple
		onchange={(event) => addFiles(event.currentTarget.files)}
	/>

	{#if files.length}
		<div class="file-grid">
			{#each files as item}
				<div class="file-card">
					<span class="play-icon"
						><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
							><path d="M8 5v14l11-7z" /></svg
						></span
					>
					<div class="file-details">
						<strong title={item.file.name}>{item.file.name}</strong>
						<small>{sizeLabel(item.file.size)} <span>·</span> {durationLabel(item.duration)}</small>
					</div>
					<button
						type="button"
						class="remove-file"
						aria-label={`Remove ${item.file.name}`}
						onclick={() => onRemove(item.id)}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg
						>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.footage-section {
		display: grid;
		gap: 0.75rem;
	}
	.dropzone {
		position: relative;
		display: flex;
		min-height: 18rem;
		width: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border: 1px dashed var(--ink-700);
		border-radius: 2rem;
		background: rgba(32, 32, 55, 0.7);
		padding: 1.5rem;
		color: var(--ink-50);
		text-align: center;
		transition: 220ms ease;
	}
	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--lime-400);
		background: rgba(29, 52, 0, 0.45);
	}
	.dropzone:focus-visible {
		outline: 2px solid var(--lime-400);
		outline-offset: 4px;
	}
	.dropzone-glow {
		position: absolute;
		inset: 0;
		opacity: 0;
		background: radial-gradient(circle at center, rgba(181, 255, 34, 0.09), transparent 55%);
		transition: opacity 300ms;
	}
	.dropzone:hover .dropzone-glow {
		opacity: 1;
	}
	.upload-icon {
		position: relative;
		display: grid;
		width: 4rem;
		height: 4rem;
		margin-bottom: 1.5rem;
		place-items: center;
		border: 1px solid var(--ink-700);
		border-radius: 1rem;
		background: var(--ink-950);
		color: var(--lime-400);
		transition: 220ms ease;
	}
	.dropzone:hover .upload-icon {
		transform: translateY(-4px);
		border-color: var(--lime-500);
	}
	.upload-icon svg {
		width: 1.75rem;
	}
	.dropzone strong {
		position: relative;
		font-family: 'Space Grotesk', sans-serif;
		font-size: clamp(1.5rem, 3vw, 1.85rem);
		letter-spacing: -0.03em;
	}
	.dropzone small {
		position: relative;
		max-width: 30rem;
		margin-top: 0.5rem;
		color: var(--ink-300);
		line-height: 1.6;
	}
	.dropzone em {
		position: relative;
		margin-top: 1.5rem;
		border: 1px solid var(--ink-700);
		border-radius: 999px;
		background: var(--ink-950);
		padding: 0.55rem 1rem;
		color: var(--ink-300);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		font-style: normal;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
	.file-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.file-card {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid var(--ink-800);
		border-radius: 1rem;
		background: var(--ink-900);
		padding: 0.75rem 1rem;
	}
	.play-icon {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.75rem;
		background: var(--violet-950);
		color: var(--violet-300);
	}
	.play-icon svg,
	.remove-file svg {
		width: 1rem;
	}
	.file-details {
		min-width: 0;
		flex: 1;
		text-align: left;
	}
	.file-details strong {
		display: block;
		overflow: hidden;
		color: var(--ink-100);
		font-size: 0.875rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-details small {
		display: block;
		margin-top: 0.15rem;
		color: var(--ink-400);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.file-details small span {
		color: var(--lime-400);
	}
	.remove-file {
		display: grid;
		border: 0;
		border-radius: 999px;
		background: transparent;
		padding: 0.5rem;
		color: var(--ink-400);
		transition: 160ms;
	}
	.remove-file:hover {
		background: var(--ink-800);
		color: var(--ink-100);
	}
	@media (min-width: 768px) {
		.dropzone {
			min-height: 20rem;
		}
	}
	@media (max-width: 640px) {
		.file-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
