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
		display: grid;
		min-height: 22rem;
		width: 100%;
		grid-template-columns: minmax(14rem, 0.8fr) minmax(18rem, 1.2fr);
		grid-template-rows: auto auto auto;
		align-content: center;
		align-items: center;
		overflow: hidden;
		border: 1px solid rgba(36, 31, 37, 0.1);
		border-radius: 1.75rem;
		background:
			linear-gradient(120deg, rgba(217, 197, 229, 0.86), rgba(240, 224, 232, 0.72)), var(--lavender);
		padding: clamp(1.5rem, 4vw, 3rem);
		color: var(--ink);
		text-align: left;
		transition: 220ms ease;
	}
	.dropzone:hover,
	.dropzone.dragging {
		border-color: rgba(221, 114, 91, 0.35);
		box-shadow: inset 0 0 0 5px rgba(255, 253, 248, 0.3);
		transform: translateY(-2px);
	}
	.dropzone:focus-visible {
		outline: 3px solid rgba(221, 114, 91, 0.5);
		outline-offset: 4px;
	}
	.dropzone-glow {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 8% 20%, rgba(245, 160, 133, 0.5) 0 0.42rem, transparent 0.48rem),
			radial-gradient(circle at 88% 18%, rgba(146, 181, 199, 0.55) 0 0.7rem, transparent 0.76rem),
			radial-gradient(circle at 82% 82%, rgba(224, 163, 52, 0.5) 0 0.62rem, transparent 0.68rem);
		pointer-events: none;
	}
	.upload-illustration {
		position: relative;
		z-index: 1;
		display: block;
		grid-column: 1;
		grid-row: 1 / 4;
		width: min(17rem, 90%);
		aspect-ratio: 1;
		justify-self: center;
		transition: 220ms ease;
	}
	.upload-illustration::before {
		position: absolute;
		inset: 12%;
		border-radius: 35%;
		background: rgba(255, 253, 248, 0.5);
		content: '';
		filter: blur(24px);
	}
	.upload-illustration img {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 2rem;
		object-fit: cover;
		mix-blend-mode: multiply;
	}
	.upload-arrow {
		position: absolute;
		right: 4%;
		bottom: 8%;
		display: grid;
		width: 3.25rem;
		height: 3.25rem;
		place-items: center;
		border: 5px solid rgba(255, 253, 248, 0.9);
		border-radius: 999px;
		background: linear-gradient(145deg, var(--mustard-light), var(--mustard));
		box-shadow: 0 12px 28px rgba(98, 66, 18, 0.22);
	}
	.upload-arrow svg {
		width: 1.25rem;
	}
	.dropzone:hover .upload-illustration {
		transform: rotate(-2deg) scale(1.025);
	}
	.dropzone strong,
	.dropzone small,
	.dropzone em {
		position: relative;
		z-index: 1;
		grid-column: 2;
		justify-self: start;
	}
	.dropzone strong {
		align-self: end;
		font-size: clamp(2rem, 4vw, 3.3rem);
		font-weight: 700;
		letter-spacing: -0.055em;
		line-height: 0.98;
	}
	.dropzone small {
		max-width: 32rem;
		margin-top: 0.75rem;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.6;
	}
	.dropzone em {
		align-self: start;
		margin-top: 1.35rem;
		border: 1px solid rgba(36, 31, 37, 0.12);
		border-radius: 999px;
		background: rgba(255, 253, 248, 0.66);
		padding: 0.55rem 0.9rem;
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
		gap: 0.55rem;
	}
	.file-card {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid rgba(36, 31, 37, 0.1);
		border-radius: 1rem;
		background: var(--surface-strong);
		padding: 0.72rem 0.85rem;
		box-shadow: 0 7px 20px rgba(66, 45, 63, 0.05);
	}
	.play-icon {
		display: grid;
		width: 2.35rem;
		height: 2.35rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.75rem;
		background: rgba(146, 181, 199, 0.55);
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
		background: rgba(245, 160, 133, 0.24);
		color: var(--ink);
	}
	@media (max-width: 760px) {
		.dropzone {
			min-height: 22rem;
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto auto;
			padding: 1.5rem;
			text-align: center;
		}
		.upload-illustration {
			grid-column: 1;
			grid-row: 1;
			width: 9.5rem;
		}
		.dropzone strong,
		.dropzone small,
		.dropzone em {
			grid-column: 1;
			justify-self: center;
		}
		.dropzone strong {
			font-size: clamp(1.8rem, 9vw, 2.5rem);
		}
		.dropzone em {
			margin-top: 1rem;
		}
	}
	@media (max-width: 640px) {
		.file-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
