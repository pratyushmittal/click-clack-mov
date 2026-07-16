<script>
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import MovieResult from '$lib/components/MovieResult.svelte';
	import ProcessingStage from '$lib/components/ProcessingStage.svelte';
	import { createMovie, getMovieStatus } from '$lib/js/movie-maker.js';

	let files = $state([]);
	let vibe = $state('');
	let targetSeconds = $state(0);
	let targetEdited = $state(false);
	let activePreset = $state('');
	let processing = $state(false);
	let processingStartedAt = $state(0);
	let processingSeconds = $state(0);
	let error = $state('');
	let result = $state(null);
	let importLabel = $state('');
	let activeJobId = $state('');
	let jobStatus = $state({});

	let combinedDuration = $derived(
		files.reduce((total, item) => total + (Number.isFinite(item.duration) ? item.duration : 0), 0)
	);

	const vibePresets = [
		{
			id: 'teaser',
			label: 'Teasers',
			vibe: 'Punchy teaser with the strongest reveals, reactions, and memorable moments.',
			seconds: 30
		},
		{
			id: 'vlog',
			label: 'Vlogs',
			vibe: 'Natural, warm vlog with candid dialogue, personality, and a clear sense of the day.',
			seconds: 180
		},
		{
			id: 'story',
			label: 'Story mode',
			vibe: 'Story-first edit with a complete beginning, middle, and satisfying ending. Take as long as the story needs.',
			seconds: null
		},
		{
			id: 'reel',
			label: 'Reels',
			vibe: 'Fast social reel with an immediate hook, tight pacing, and only the most scroll-stopping moments.',
			seconds: 45
		},
		{
			id: 'slick',
			label: 'Slick cuts',
			vibe: 'Polished and energetic with crisp cuts, visual rhythm, tasteful speed changes, and smooth transitions.',
			seconds: 60
		}
	];

	function suggestedTarget() {
		return Math.max(1, Math.min(combinedDuration * 0.25, 60 * 60));
	}

	function applyPreset(preset) {
		activePreset = preset.id;
		vibe = preset.vibe;
		targetEdited = true;
		targetSeconds = preset.seconds ?? 0;
	}

	function readDuration(file) {
		return new Promise((resolve) => {
			const video = document.createElement('video');
			const url = URL.createObjectURL(file);
			video.preload = 'metadata';
			video.onloadedmetadata = () => {
				URL.revokeObjectURL(url);
				resolve(video.duration);
			};
			video.onerror = () => {
				URL.revokeObjectURL(url);
				resolve(Number.NaN);
			};
			video.src = url;
		});
	}

	async function addFiles(newFiles) {
		const additions = newFiles.map((file) => ({
			id: crypto.randomUUID(),
			file,
			duration: Number.NaN
		}));
		files = [...files, ...additions];
		error = '';

		for (let index = 0; index < additions.length; index += 4) {
			// Large selections should not create an unbounded number of video decoders.
			await Promise.all(
				additions.slice(index, index + 4).map(async (item) => {
					const duration = await readDuration(item.file);
					files = files.map((current) =>
						current.id === item.id ? { ...current, duration } : current
					);
				})
			);
		}

		if (!targetEdited) targetSeconds = suggestedTarget();
	}

	function removeFile(id) {
		files = files.filter((item) => item.id !== id);
		if (!targetEdited) targetSeconds = suggestedTarget();
	}

	async function followJob(jobId) {
		activeJobId = jobId;
		jobStatus = { message: 'Starting the editing pipeline' };

		while (activeJobId === jobId) {
			try {
				const data = await getMovieStatus(jobId);
				jobStatus = data.status;
			} catch (err) {
				// The job directory may not exist during the first status request.
				if (err.status !== 404) console.error('Could not read movie status', err);
			}
			await new Promise((resolve) => setTimeout(resolve, 800));
		}
	}

	async function submit() {
		// A double click can arrive before the processing view replaces the form.
		if (processing) return;
		if (!files.length) return (error = 'Drop in at least one video first.');
		if (files.some((item) => !Number.isFinite(item.duration))) {
			return (error = 'Wait until the video lengths have been read.');
		}
		if (vibe.trim().length < 3) return (error = 'Tell us what kind of moments you want to keep.');

		processingStartedAt = Date.now();
		processingSeconds = 0;
		processing = true;
		error = '';
		jobStatus = {};

		try {
			const data = await createMovie({
				files: files.map((item) => item.file),
				vibe: vibe.trim(),
				targetMinutes: targetSeconds ? targetSeconds / 60 : null,
				onImport: (index, total, fileName) => {
					importLabel = index < total ? `Importing ${index + 1} of ${total}: ${fileName}` : '';
				},
				onJob: (jobId) => void followJob(jobId)
			});
			processingSeconds = (Date.now() - processingStartedAt) / 1000;
			result = data.result;
		} catch (err) {
			error = err.message || 'Something went wrong while making your movie.';
		} finally {
			activeJobId = '';
			processing = false;
			processingStartedAt = 0;
			importLabel = '';
		}
	}

	function reset() {
		files = [];
		vibe = '';
		targetSeconds = 0;
		targetEdited = false;
		activePreset = '';
		result = null;
		error = '';
		activeJobId = '';
		processingStartedAt = 0;
		processingSeconds = 0;
		jobStatus = {};
	}
</script>

<svelte:head>
	<title>Click Clack Mov — Little moments, cut together</title>
	<meta
		name="description"
		content="Drop your raw footage, describe the vibe, and let Click Clack Mov find the story."
	/>
	<meta property="og:title" content="Click Clack Mov" />
	<meta property="og:description" content="Little moments, cut together." />
	<meta property="og:image" content="/images/cow-camera-wide.webp" />
</svelte:head>

<main class="app-shell">
	<div class="page-container">
		<div class="brand-lockup">
			<img src="/images/cow-film-frame.webp" alt="Cow filming through a movie frame" />
			<div>
				<p>Click Clack</p>
				<strong>Mov</strong>
			</div>
			<span>Little moments,<br />cut together.</span>
		</div>
		{#if result}
			<MovieResult {result} {processingSeconds} onReset={reset} />
		{:else}
			<div class="composer">
				{#if processing}
					<ProcessingStage
						{files}
						startedAt={processingStartedAt}
						status={jobStatus}
						message={importLabel || jobStatus.message || 'Preparing your footage'}
					/>
				{:else}
					<FileDropzone {files} onAdd={addFiles} onRemove={removeFile} />
					<div class="controls">
						<div class="vibe-input">
							<label for="vibe"><i></i> Vibe</label>
							<input
								id="vibe"
								bind:value={vibe}
								onkeydown={(event) => event.key === 'Enter' && submit()}
								placeholder="Warm, candid, keep the funny travel moments…"
								maxlength="1000"
							/>
							<button type="button" aria-label="Make my movie" onclick={submit}
								><svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg
								></button
							>
						</div>
						<div class="preset-row">
							<div class="presets" aria-label="Editing presets">
								{#each vibePresets as preset}
									<button
										type="button"
										class:active={activePreset === preset.id}
										aria-pressed={activePreset === preset.id}
										onclick={() => applyPreset(preset)}>{preset.label}</button
									>
								{/each}
							</div>
							{#if activePreset !== 'story'}
								<label class="target-input">
									<span>Time</span>
									<input
										aria-label="Target output duration in minutes"
										type="number"
										min="0.02"
										max="60"
										step="0.25"
										placeholder="Any"
										value={targetSeconds ? Number((targetSeconds / 60).toFixed(2)) : ''}
										oninput={(event) => {
											targetEdited = true;
											activePreset = '';
											targetSeconds = event.currentTarget.value
												? Number(event.currentTarget.value) * 60
												: 0;
										}}
									/>
									<small>min</small>
								</label>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			{#if error}
				<div class="error" role="alert">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></svg
					>{error}
				</div>
			{/if}
		{/if}

		<footer><strong>clickclack.mov</strong><span>·</span> For the little stories we keep.</footer>
	</div>
</main>

<style>
	.app-shell {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		padding: 1.5rem 1rem 2.5rem;
		color: var(--ink);
	}
	.app-shell::before {
		position: absolute;
		top: -11rem;
		right: -8rem;
		width: 34rem;
		height: 34rem;
		border-radius: 50%;
		background: rgba(245, 160, 133, 0.16);
		content: '';
		filter: blur(12px);
		pointer-events: none;
	}
	.page-container {
		position: relative;
		max-width: 68rem;
		margin: 0 auto;
	}
	.brand-lockup {
		display: flex;
		height: 5.8rem;
		align-items: center;
		gap: 0.8rem;
		margin: 0 0 1.25rem 0.35rem;
	}
	.brand-lockup img {
		width: 4.25rem;
		height: 4.25rem;
		border-radius: 1.25rem;
		object-fit: cover;
		mix-blend-mode: multiply;
	}
	.brand-lockup div {
		display: flex;
		align-items: baseline;
		gap: 0.42rem;
		white-space: nowrap;
	}
	.brand-lockup p,
	.brand-lockup strong {
		margin: 0;
		font-family: var(--font-brand);
		line-height: 0.9;
		text-transform: uppercase;
	}
	.brand-lockup p {
		font-size: clamp(1.2rem, 3vw, 1.75rem);
	}
	.brand-lockup strong {
		color: var(--coral-deep);
		font-size: clamp(1.55rem, 4vw, 2.35rem);
	}
	.brand-lockup > span {
		margin-left: auto;
		padding-right: 0.75rem;
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 600;
		line-height: 1.25;
		text-align: right;
	}
	.composer {
		border: 1px solid rgba(36, 31, 37, 0.13);
		border-radius: 2.25rem;
		background: var(--surface);
		padding: clamp(0.65rem, 2vw, 1rem);
		box-shadow:
			0 2px 4px rgba(66, 45, 63, 0.04),
			0 30px 90px var(--shadow);
		backdrop-filter: blur(22px);
	}
	.controls {
		display: grid;
		gap: 0.8rem;
		margin-top: 0.9rem;
	}
	.vibe-input {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		border: 1px solid rgba(36, 31, 37, 0.15);
		border-radius: 1.25rem;
		background: var(--surface-strong);
		padding: 0.45rem 0.45rem 0.45rem 1.1rem;
		box-shadow: 0 9px 28px rgba(66, 45, 63, 0.08);
		transition: 180ms ease;
	}
	.vibe-input:focus-within {
		border-color: rgba(221, 114, 91, 0.65);
		box-shadow: 0 0 0 4px rgba(245, 160, 133, 0.17);
	}
	.vibe-input label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.vibe-input label i {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--coral);
		box-shadow: 0 0 0 4px rgba(245, 160, 133, 0.18);
	}
	.vibe-input input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		padding: 0.8rem 0;
		color: var(--ink);
		font-size: 0.95rem;
	}
	.vibe-input input::placeholder {
		color: var(--ink-faint);
	}
	.vibe-input button {
		display: grid;
		width: 3rem;
		height: 3rem;
		flex: 0 0 auto;
		place-items: center;
		border: 0;
		border-radius: 1rem;
		background: linear-gradient(145deg, var(--coral), var(--coral-deep));
		color: var(--white);
		box-shadow: 0 9px 20px rgba(221, 114, 91, 0.28);
		transition: 160ms ease;
	}
	.vibe-input button:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 13px 28px rgba(221, 114, 91, 0.34);
	}
	.vibe-input svg {
		width: 1.25rem;
	}
	.preset-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0 0.25rem;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.presets button {
		border: 1px solid rgba(36, 31, 37, 0.12);
		border-radius: 999px;
		background: rgba(255, 253, 248, 0.64);
		padding: 0.48rem 0.78rem;
		color: var(--ink-soft);
		font-size: 0.7rem;
		font-weight: 700;
		transition: 150ms ease;
	}
	.presets button:hover {
		border-color: rgba(36, 31, 37, 0.24);
		background: var(--white);
		color: var(--ink);
		transform: translateY(-1px);
	}
	.presets button.active {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--white);
	}
	.target-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
		border: 1px solid rgba(36, 31, 37, 0.13);
		border-radius: 0.85rem;
		background: rgba(255, 253, 248, 0.72);
		padding: 0.4rem 0.7rem;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.target-input:focus-within {
		border-color: var(--mustard);
		background: var(--white);
	}
	.target-input input {
		width: 3.5rem;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--ink);
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		text-align: right;
	}
	.target-input input::placeholder,
	.target-input small {
		color: var(--ink-faint);
	}
	.target-input small {
		font-size: inherit;
	}
	.error {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-top: 1.25rem;
		border: 1px solid rgba(221, 114, 91, 0.35);
		border-radius: 1rem;
		background: rgba(245, 160, 133, 0.2);
		padding: 1rem 1.25rem;
		color: #8c3e31;
		font-size: 0.875rem;
	}
	.error svg {
		width: 1rem;
		flex: 0 0 auto;
	}
	footer {
		display: flex;
		justify-content: center;
		gap: 0.55rem;
		margin-top: 2.5rem;
		color: var(--ink-soft);
		font-size: 0.72rem;
	}
	footer strong {
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
	}
	@media (max-width: 680px) {
		.app-shell {
			padding-inline: 0.75rem;
		}
		.brand-lockup {
			height: 5.25rem;
			margin-left: 0.25rem;
		}
		.brand-lockup img {
			width: 3.8rem;
			height: 3.8rem;
		}
		.brand-lockup > span,
		.vibe-input label {
			display: none;
		}
		.composer {
			border-radius: 1.6rem;
		}
		.preset-row {
			align-items: flex-start;
		}
		.target-input {
			flex: 0 0 auto;
		}
	}
</style>
