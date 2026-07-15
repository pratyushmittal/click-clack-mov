<script>
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import MovieResult from '$lib/components/MovieResult.svelte';
	import ProcessingStage from '$lib/components/ProcessingStage.svelte';
	import { createMovie, getMovieStatus } from '$lib/js/movie-maker.js';

	let files = $state([]);
	let vibe = $state('');
	let targetSeconds = $state(0);
	let targetEdited = $state(false);
	let processing = $state(false);
	let error = $state('');
	let result = $state(null);
	let importLabel = $state('');
	let activeJobId = $state('');
	let jobStatus = $state({});

	let combinedDuration = $derived(
		files.reduce((total, item) => total + (Number.isFinite(item.duration) ? item.duration : 0), 0)
	);
	let maximumTarget = $derived(Math.max(1, Math.min(combinedDuration || 1, 60 * 60)));

	function durationLabel(seconds) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = Math.round(seconds % 60);
		return hours
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
			: `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
	}

	function suggestedTarget() {
		return Math.max(1, Math.min(combinedDuration * 0.25, 60 * 60));
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
		const additions = newFiles.slice(0, Math.max(0, 12 - files.length)).map((file) => ({
			id: crypto.randomUUID(),
			file,
			duration: Number.NaN
		}));
		files = [...files, ...additions];
		error = '';

		await Promise.all(
			additions.map(async (item) => {
				const duration = await readDuration(item.file);
				files = files.map((current) =>
					current.id === item.id ? { ...current, duration } : current
				);
			})
		);

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

		processing = true;
		error = '';
		jobStatus = {};

		try {
			const data = await createMovie({
				files: files.map((item) => item.file),
				vibe: vibe.trim(),
				targetMinutes: targetSeconds / 60,
				onImport: (index, total, fileName) => {
					importLabel = index < total ? `Importing ${index + 1} of ${total}: ${fileName}` : '';
				},
				onJob: (jobId) => void followJob(jobId)
			});
			result = data.result;
		} catch (err) {
			error = err.message || 'Something went wrong while making your movie.';
		} finally {
			activeJobId = '';
			processing = false;
			importLabel = '';
		}
	}

	function reset() {
		files = [];
		vibe = '';
		targetSeconds = 0;
		targetEdited = false;
		result = null;
		error = '';
		activeJobId = '';
		jobStatus = {};
	}
</script>

<svelte:head>
	<title>Vlogger — Find the story in your footage</title>
	<meta
		name="description"
		content="Drop your raw vlog footage, describe the vibe, and get an AI-edited first cut."
	/>
</svelte:head>

<main class="app-shell">
	<div class="violet-glow"></div>
	<div class="lime-glow"></div>
	<div class="page-container">
		{#if result}
			<MovieResult {result} onReset={reset} />
		{:else}
			<div class="composer">
				{#if processing}
					<ProcessingStage
						{files}
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
						<div class="target-row">
							<div class="target-control">
								<div class="target-label">
									<span>Target output</span><strong
										>{targetSeconds ? durationLabel(targetSeconds) : '—'}</strong
									>
								</div>
								<input
									aria-label="Target output duration"
									type="range"
									min="1"
									max={maximumTarget}
									step="0.1"
									value={Math.min(targetSeconds || 1, maximumTarget)}
									disabled={!combinedDuration}
									oninput={(event) => {
										targetEdited = true;
										targetSeconds = Number(event.currentTarget.value);
									}}
								/>
								<small
									>Starts at 25% of {combinedDuration
										? durationLabel(combinedDuration)
										: 'your footage'}</small
								>
							</div>
							<p>Your files are processed locally before AI analysis.</p>
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

		<footer>Transcribe <span>·</span> See <span>·</span> Select <span>·</span> Assemble</footer>
	</div>
</main>

<style>
	.app-shell {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		background: var(--ink-950);
		padding: 1.5rem 1rem;
		color: var(--ink-50);
	}
	.violet-glow,
	.lime-glow {
		position: absolute;
		pointer-events: none;
		border-radius: 999px;
		filter: blur(120px);
	}
	.violet-glow {
		top: -22rem;
		left: 50%;
		width: 58rem;
		height: 34rem;
		transform: translateX(-50%);
		background: rgba(50, 16, 95, 0.55);
	}
	.lime-glow {
		right: -10rem;
		bottom: -10rem;
		width: 24rem;
		height: 24rem;
		background: rgba(29, 52, 0, 0.4);
	}
	.page-container {
		position: relative;
		max-width: 64rem;
		margin: 0 auto;
		padding-top: clamp(1rem, 6vw, 4rem);
	}
	.composer {
		border: 1px solid var(--ink-800);
		border-radius: 2.5rem;
		background: rgba(32, 32, 55, 0.4);
		padding: clamp(0.75rem, 2vw, 1.25rem);
		box-shadow: 0 0 80px rgba(181, 255, 34, 0.1);
		backdrop-filter: blur(12px);
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
		border: 1px solid var(--ink-700);
		border-radius: 999px;
		background: var(--ink-950);
		padding: 0.5rem 0.5rem 0.5rem 1.25rem;
		box-shadow: 0 24px 80px rgba(4, 4, 12, 0.35);
	}
	.vibe-input:focus-within {
		border-color: var(--violet-500);
		box-shadow: 0 0 0 2px var(--violet-950);
	}
	.vibe-input label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--violet-300);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.vibe-input label i {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--violet-400);
	}
	.vibe-input input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		padding: 0.75rem 0;
		color: var(--ink-50);
	}
	.vibe-input input::placeholder {
		color: var(--ink-500);
	}
	.vibe-input button {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 auto;
		place-items: center;
		border: 0;
		border-radius: 999px;
		background: var(--lime-400);
		color: var(--ink-950);
		transition: 160ms;
	}
	.vibe-input button:hover {
		transform: scale(1.05);
		background: var(--lime-300);
	}
	.vibe-input button:disabled {
		cursor: not-allowed;
		background: var(--ink-700);
		color: var(--ink-400);
	}
	.vibe-input svg {
		width: 1.25rem;
	}
	.target-row {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 0.5rem 0.25rem;
	}
	.target-row > p {
		margin: 0;
		color: var(--ink-500);
		font-size: 0.75rem;
	}
	.target-control {
		width: min(24rem, 100%);
		border: 1px solid var(--ink-800);
		border-radius: 1rem;
		background: var(--ink-900);
		padding: 0.75rem 1rem;
	}
	.target-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.target-label span {
		color: var(--ink-300);
		font-size: 0.75rem;
	}
	.target-label strong {
		color: var(--lime-400);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
	}
	.target-control input {
		width: 100%;
		margin: 0.65rem 0 0.25rem;
		accent-color: var(--lime-400);
	}
	.target-control small {
		color: var(--ink-500);
		font-size: 0.68rem;
	}
	.error {
		margin-top: 1.25rem;
		border-radius: 1rem;
		padding: 1.25rem;
	}
	.error {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		border: 1px solid var(--violet-800);
		background: rgba(50, 16, 95, 0.6);
		color: var(--violet-300);
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
		margin-top: 3rem;
		color: var(--ink-600);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	@media (min-width: 640px) {
		.app-shell {
			padding-inline: 1.5rem;
		}
	}
	@media (min-width: 768px) {
		.app-shell {
			padding-block: 2.5rem;
		}
	}
	@media (max-width: 680px) {
		.vibe-input label {
			display: none;
		}
		.target-row {
			align-items: stretch;
			flex-direction: column;
		}
		.target-row > p {
			text-align: center;
		}
	}
</style>
