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
		<span class="upload-illustration">
			<img src="/images/cow-film-frame.webp" alt="" />
			<span class="upload-arrow" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
				</svg>
			</span>
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
		min-height: 20rem;
		width: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border: 2px dashed var(--ink);
		border-radius: 1.45rem 1.8rem 1.35rem 1.95rem;
		background: var(--lavender);
		padding: 1.5rem;
		color: var(--ink);
		text-align: center;
		transition: 180ms ease;
	}
	.dropzone:hover,
	.dropzone.dragging {
		background: #e5d7ed;
		box-shadow: inset 0 0 0 5px rgba(255, 249, 239, 0.55);
	}
	.dropzone:focus-visible {
		outline: 3px solid var(--coral-deep);
		outline-offset: 4px;
	}
	.dropzone-glow {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 10% 20%, rgba(245, 160, 133, 0.26) 0 0.45rem, transparent 0.5rem),
			radial-gradient(circle at 86% 22%, rgba(146, 181, 199, 0.4) 0 0.65rem, transparent 0.7rem),
			radial-gradient(circle at 80% 80%, rgba(224, 163, 52, 0.33) 0 0.55rem, transparent 0.6rem);
		pointer-events: none;
	}
	.upload-illustration {
		position: relative;
		display: block;
		width: 8.75rem;
		height: 8.75rem;
		margin-bottom: 0.35rem;
		transition: 180ms ease;
	}
	.upload-illustration img {
		width: 100%;
		height: 100%;
		border-radius: 1.4rem;
		object-fit: cover;
		mix-blend-mode: multiply;
	}
	.upload-arrow {
		position: absolute;
		right: -0.25rem;
		bottom: 0.35rem;
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--mustard);
		box-shadow: 2px 2px 0 var(--ink);
	}
	.upload-arrow svg {
		width: 1.2rem;
	}
	.dropzone:hover .upload-illustration {
		transform: rotate(-2deg) translateY(-3px);
	}
	.dropzone strong {
		position: relative;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3vw, 1.9rem);
		font-weight: 400;
	}
	.dropzone small {
		position: relative;
		max-width: 31rem;
		margin-top: 0.35rem;
		color: var(--ink-soft);
		line-height: 1.55;
	}
	.dropzone em {
		position: relative;
		margin-top: 1rem;
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		padding: 0.45rem 0.85rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-style: normal;
		letter-spacing: 0.08em;
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
		border: 1.5px solid var(--ink);
		border-radius: 0.9rem 1.05rem 0.85rem 1.1rem;
		background: var(--white);
		padding: 0.72rem 0.85rem;
	}
	.play-icon {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		flex: 0 0 auto;
		place-items: center;
		border: 1.5px solid var(--ink);
		border-radius: 0.65rem;
		background: var(--blue);
		color: var(--ink);
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
		color: var(--ink);
		font-size: 0.875rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-details small {
		display: block;
		margin-top: 0.15rem;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}
	.file-details small span {
		color: var(--coral-deep);
	}
	.remove-file {
		display: grid;
		border: 0;
		border-radius: 999px;
		background: transparent;
		padding: 0.5rem;
		color: var(--ink-soft);
	}
	.remove-file:hover {
		background: var(--coral);
		color: var(--ink);
	}
	@media (max-width: 640px) {
		.dropzone {
			min-height: 18rem;
		}
		.file-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
