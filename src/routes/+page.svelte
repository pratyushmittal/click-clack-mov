<script>
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import MovieResult from '$lib/components/MovieResult.svelte';
	import { createMovie } from '$lib/js/movie-maker.js';

	let files = $state([]);
	let vibe = $state('');
	let targetSeconds = $state(0);
	let targetEdited = $state(false);
	let processing = $state(false);
	let error = $state('');
	let result = $state(null);
	let progressIndex = $state(0);
	let importLabel = $state('');
	let progressTimer;

	let combinedDuration = $derived(
		files.reduce((total, item) => total + (Number.isFinite(item.duration) ? item.duration : 0), 0)
	);
	let maximumTarget = $derived(Math.max(1, Math.min(combinedDuration || 1, 60 * 60)));

	const progress = [
		'Preparing your footage',
		'Listening for the best lines',
		'Building visual contact sheets',
		'Finding moments that match your vibe',
		'Assembling your first cut'
	];

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

	async function submit() {
		if (!files.length) return (error = 'Drop in at least one video first.');
		if (files.some((item) => !Number.isFinite(item.duration))) {
			return (error = 'Wait until the video lengths have been read.');
		}
		if (vibe.trim().length < 3) return (error = 'Tell us what kind of moments you want to keep.');

		processing = true;
		error = '';
		progressIndex = 0;
		progressTimer = setInterval(() => {
			progressIndex = Math.min(progressIndex + 1, progress.length - 1);
		}, 8000);

		try {
			const data = await createMovie({
				files: files.map((item) => item.file),
				vibe: vibe.trim(),
				targetMinutes: targetSeconds / 60,
				onImport: (index, total, fileName) => {
					importLabel = index < total ? `Importing ${index + 1} of ${total}: ${fileName}` : '';
				}
			});
			result = data.result;
		} catch (err) {
			error = err.message || 'Something went wrong while making your movie.';
		} finally {
			clearInterval(progressTimer);
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
		<header class="site-header">
			<a href="/" class="brand"
				><span
					><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
						><path d="M8 5v14l11-7z" /></svg
					></span
				>Vlogger</a
			>
			<em>MVP · First cut</em>
		</header>

		{#if result}
			<MovieResult {result} onReset={reset} />
		{:else}
			<section class="hero">
				<p>Raw footage in. Story out.</p>
				<h1>Find the film hiding in your <span>camera roll.</span></h1>
				<div>
					Drop your clips, describe what matters, and let Vlogger find and assemble your strongest
					moments.
				</div>
			</section>

			<div class="composer">
				<FileDropzone {files} onAdd={addFiles} onRemove={removeFile} />
				<div class="controls">
					<div class="vibe-input">
						<label for="vibe"><i></i> Vibe</label>
						<input
							id="vibe"
							bind:value={vibe}
							onkeydown={(event) => event.key === 'Enter' && !processing && submit()}
							placeholder="Warm, candid, keep the funny travel moments…"
							maxlength="1000"
						/>
						<button type="button" disabled={processing} aria-label="Make my movie" onclick={submit}
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
			</div>

			{#if processing}
				<div class="progress" aria-live="polite">
					<div><strong>{importLabel || progress[progressIndex]}</strong><span>Working</span></div>
					<i><b></b></i>
					<p>
						Long footage can take several minutes. Keep this tab open while your first cut is
						rendered.
					</p>
				</div>
			{/if}
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
	}
	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: clamp(2.5rem, 6vw, 4rem);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--ink-50);
		font-family: 'Space Grotesk', sans-serif;
		font-size: 1.1rem;
		font-weight: 700;
		text-decoration: none;
	}
	.brand span {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		border-radius: 0.75rem;
		background: var(--lime-400);
		color: var(--ink-950);
	}
	.brand svg {
		width: 1rem;
	}
	.site-header em {
		border: 1px solid var(--ink-800);
		border-radius: 999px;
		background: rgba(32, 32, 55, 0.7);
		padding: 0.45rem 0.8rem;
		color: var(--ink-300);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		font-style: normal;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.hero {
		margin-bottom: clamp(2.25rem, 5vw, 3rem);
		text-align: center;
	}
	.hero p {
		margin: 0 0 1rem;
		color: var(--lime-400);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
	}
	.hero h1 {
		max-width: 48rem;
		margin: 0 auto;
		color: var(--ink-50);
		font-family: 'Space Grotesk', sans-serif;
		font-size: clamp(2.5rem, 7vw, 4rem);
		font-weight: 600;
		line-height: 1.04;
		letter-spacing: -0.045em;
	}
	.hero h1 span {
		color: var(--violet-300);
	}
	.hero div {
		max-width: 38rem;
		margin: 1.25rem auto 0;
		color: var(--ink-300);
		font-size: clamp(1rem, 2vw, 1.1rem);
		line-height: 1.6;
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
	.progress,
	.error {
		margin-top: 1.25rem;
		border-radius: 1rem;
		padding: 1.25rem;
	}
	.progress {
		border: 1px solid var(--lime-900);
		background: rgba(29, 52, 0, 0.5);
	}
	.progress > div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.progress strong {
		color: var(--ink-100);
		font-size: 0.875rem;
	}
	.progress span {
		color: var(--lime-400);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.progress i {
		display: block;
		height: 0.35rem;
		overflow: hidden;
		margin-top: 0.75rem;
		border-radius: 999px;
		background: var(--ink-900);
	}
	.progress b {
		display: block;
		width: 33%;
		height: 100%;
		border-radius: inherit;
		background: var(--lime-400);
		animation: pulse 1.4s infinite alternate;
	}
	.progress p {
		margin: 0.75rem 0 0;
		color: var(--ink-300);
		font-size: 0.75rem;
		line-height: 1.5;
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
	@keyframes pulse {
		to {
			transform: translateX(200%);
			opacity: 0.55;
		}
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
