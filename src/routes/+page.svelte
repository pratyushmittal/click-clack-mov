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
		padding: 1.25rem 1rem 2rem;
		color: var(--ink);
	}
	.app-shell::before,
	.app-shell::after {
		position: absolute;
		content: '';
		pointer-events: none;
		border: 3px solid var(--ink);
		opacity: 0.08;
		transform: rotate(-8deg);
	}
	.app-shell::before {
		top: 7rem;
		left: -5rem;
		width: 12rem;
		height: 8rem;
		border-radius: 48% 52% 44% 56%;
		background: var(--ink);
	}
	.app-shell::after {
		right: -4rem;
		bottom: 4rem;
		width: 10rem;
		height: 6rem;
		border-radius: 52% 48% 58% 42%;
		background: var(--ink);
	}
	.page-container {
		position: relative;
		max-width: 64rem;
		margin: 0 auto;
	}
	.brand-lockup {
		display: flex;
		height: 6.5rem;
		align-items: center;
		gap: 0.85rem;
		margin: 0 0 1rem 0.6rem;
	}
	.brand-lockup img {
		width: 4.6rem;
		height: 4.6rem;
		border-radius: 1rem;
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
		color: var(--ink);
		font-family: var(--font-brand);
		line-height: 0.9;
		text-transform: uppercase;
	}
	.brand-lockup p {
		font-size: clamp(1.25rem, 3vw, 2rem);
	}
	.brand-lockup strong {
		color: var(--coral-deep);
		font-size: clamp(1.65rem, 4vw, 2.7rem);
	}
	.brand-lockup > span {
		margin-left: auto;
		padding-right: 0.75rem;
		color: var(--ink-soft);
		font-family: var(--font-display);
		font-size: 0.88rem;
		line-height: 1.15;
		text-align: right;
	}
	.composer {
		border: 3px solid var(--ink);
		border-radius: 2rem 2.35rem 1.9rem 2.5rem;
		background: rgba(255, 249, 239, 0.92);
		padding: clamp(0.7rem, 2vw, 1.15rem);
		box-shadow: 9px 11px 0 rgba(36, 31, 37, 0.12);
	}
	.controls {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.vibe-input {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border: 2px solid var(--ink);
		border-radius: 1rem 1.25rem 1rem 1.35rem;
		background: var(--white);
		padding: 0.45rem 0.45rem 0.45rem 1.15rem;
		box-shadow: 4px 4px 0 var(--lavender);
	}
	.vibe-input:focus-within {
		box-shadow: 4px 4px 0 var(--coral);
	}
	.vibe-input label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.vibe-input label i {
		width: 0.55rem;
		height: 0.55rem;
		border: 1px solid var(--ink);
		border-radius: 999px;
		background: var(--coral);
	}
	.vibe-input input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		padding: 0.75rem 0;
		color: var(--ink);
	}
	.vibe-input input::placeholder {
		color: var(--ink-faint);
	}
	.vibe-input button {
		display: grid;
		width: 2.85rem;
		height: 2.85rem;
		flex: 0 0 auto;
		place-items: center;
		border: 2px solid var(--ink);
		border-radius: 0.9rem 1.1rem 0.85rem 1.2rem;
		background: var(--mustard);
		color: var(--ink);
		box-shadow: 3px 3px 0 var(--ink);
		transition: 140ms;
	}
	.vibe-input button:hover {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--ink);
	}
	.vibe-input svg {
		width: 1.25rem;
	}
	.preset-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0 0.35rem;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.presets button {
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		padding: 0.42rem 0.7rem;
		color: var(--ink-soft);
		font-size: 0.7rem;
		font-weight: 700;
		transition: 140ms;
	}
	.presets button:nth-child(2n) {
		transform: rotate(1deg);
	}
	.presets button:hover,
	.presets button.active {
		background: var(--lavender);
		color: var(--ink);
	}
	.target-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
		border: 1.5px solid var(--ink);
		border-radius: 0.8rem;
		background: var(--paper);
		padding: 0.35rem 0.65rem;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	.target-input:focus-within {
		background: var(--mustard-light);
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
		border: 2px solid var(--ink);
		border-radius: 1rem;
		background: var(--coral);
		padding: 1rem 1.25rem;
		color: var(--ink);
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
		margin-top: 2.4rem;
		color: var(--ink-soft);
		font-size: 0.72rem;
	}
	footer strong {
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
	}
	@media (max-width: 680px) {
		.brand-lockup {
			height: 5.5rem;
			margin-left: 0;
		}
		.brand-lockup img {
			width: 4rem;
			height: 4rem;
		}
		.brand-lockup > span {
			display: none;
		}
		.vibe-input label {
			display: none;
		}
		.preset-row {
			align-items: flex-start;
		}
		.target-input {
			flex: 0 0 auto;
		}
	}
</style>
