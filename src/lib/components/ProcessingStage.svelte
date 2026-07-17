<script>
	import { onMount } from 'svelte';

	const toolTitles = [
		'Turning chaos into cinema',
		'Giving the timeline a tiny haircut',
		'Finding the main-character moment',
		'Putting the good bits in order',
		'Negotiating with FFmpeg',
		'Teaching pixels to tell a story',
		'Snipping out the waffle',
		'Checking if that cut actually slaps'
	];
	const slideshowFilters = [
		'invert(1) grayscale(1) contrast(1.1)',
		'hue-rotate(180deg) saturate(1.8) contrast(1.08)',
		'grayscale(1) contrast(1.2)',
		'sepia(0.85) saturate(1.4) contrast(1.05)'
	];

	let { files, status, message, startedAt } = $props();
	let video = $state();
	let videoUrl = $state('');
	let slideshowOrder = $state([]);
	let slideshowPosition = $state(0);
	let slideshowPass = $state(0);
	let latestToolEvent = $state('');
	let toolTitleIndex = $state(0);
	let now = $state(Date.now());

	let processingVideos = $derived(
		Object.values(status.processingVideos || {}).sort((left, right) => left.index - right.index)
	);
	let editing = $derived(status.phase === 'editing' || status.phase === 'finalizing');
	let processingVideo = $derived(processingVideos[0] || null);
	let processingFile = $derived(files[processingVideo?.index]?.file);
	let mediaFileIndex = $derived(slideshowOrder[slideshowPosition] ?? 0);
	let mediaFile = $derived(files[mediaFileIndex]?.file);
	let newestEvent = $derived(status.events?.at(-1));
	let previewFilter = $derived(slideshowFilters[slideshowPass % slideshowFilters.length]);
	let title = $derived.by(() => {
		if (status.phase === 'finalizing') return 'Finishing your movie';
		if (editing) {
			if (newestEvent) return toolTitles[toolTitleIndex];
			return 'Finding the shape of your story';
		}
		if (!processingVideo) return 'Preparing your footage';
		if (!processingVideo.transcriptReady) return 'Generating the transcript';
		if (!processingVideo.contactSheetReady) return 'Building the camera roll';
		return 'Wrapping up this video';
	});
	let elapsed = $derived(Math.max(0, Math.floor((now - startedAt) / 1000)));
	let detail = $derived(
		`${
			editing || !processingVideo
				? message
				: `Analyzing video ${processingVideo.index + 1} of ${files.length}: ${processingFile.name}`
		} · ${timeLabel(elapsed)} elapsed`
	);

	$effect(() => {
		const fileCount = files.length;
		// Files are fixed for this processing run, so build the slideshow only once.
		if (!fileCount || slideshowOrder.length) return;
		slideshowOrder = Array.from({ length: fileCount }, (_, index) => index).sort(
			() => Math.random() - 0.5
		);
	});

	$effect(() => {
		const eventId = newestEvent?.createdAt;
		if (!eventId || eventId === latestToolEvent) return;
		latestToolEvent = eventId;
		toolTitleIndex =
			(toolTitleIndex + 1 + Math.floor(Math.random() * (toolTitles.length - 1))) %
			toolTitles.length;
	});

	function timeLabel(seconds) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = seconds % 60;
		return hours
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
			: `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
	}

	function advanceSlideshow() {
		const lastPosition = slideshowOrder.length - 1;
		if (slideshowPosition < lastPosition) {
			slideshowPosition += 1;
			return;
		}

		const previousFile = slideshowOrder[lastPosition];
		const nextOrder = Array.from({ length: files.length }, (_, index) => index).sort(
			() => Math.random() - 0.5
		);
		// Rotate the deck so pass boundaries never show the same file twice.
		if (nextOrder.length > 1 && nextOrder[0] === previousFile) nextOrder.push(nextOrder.shift());
		slideshowOrder = nextOrder;
		slideshowPosition = 0;
		slideshowPass += 1;
	}

	onMount(() => {
		// The independent timer keeps moving while status polling and Bash calls continue.
		const slideshowTimer = setInterval(advanceSlideshow, 4000);
		const clockTimer = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(slideshowTimer);
			clearInterval(clockTimer);
		};
	});

	$effect(() => {
		const file = mediaFile;
		if (!file) {
			videoUrl = '';
			return;
		}
		const url = URL.createObjectURL(file);
		videoUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	function playPreview() {
		if (!video) return;
		video.playbackRate = 1.5;
		if (video.duration) video.currentTime = Math.random() * Math.max(0, video.duration - 8);
		video.play().catch(() => {});
	}
</script>

<section class="processing-stage">
	<div class="media">
		{#if videoUrl}
			<video
				bind:this={video}
				src={videoUrl}
				muted
				playsinline
				loop={files.length === 1}
				style:filter={previewFilter}
				onloadedmetadata={playPreview}
				aria-label={`Preview of ${mediaFile.name}`}
			></video>
		{:else}
			<div class="waiting"><span></span><span></span><span></span></div>
		{/if}
	</div>

	<div class="copy" aria-live="polite">
		<h2>{title}</h2>
		<p>{detail}</p>
	</div>
</section>

<style>
	.processing-stage {
		overflow: hidden;
		border: 1px solid rgba(36, 31, 37, 0.12);
		border-radius: 1.75rem;
		background: var(--surface-strong);
		box-shadow: 0 26px 80px var(--shadow);
	}
	.media {
		display: grid;
		min-height: 24rem;
		max-height: 36rem;
		place-items: center;
		overflow: hidden;
		background: linear-gradient(145deg, var(--lavender), #eadff0);
	}
	.media video {
		width: 100%;
		height: 100%;
		min-height: 24rem;
		max-height: 36rem;
		object-fit: contain;
		background: var(--ink);
	}
	.media video {
		object-fit: cover;
		transition: filter 500ms ease;
	}
	.copy {
		position: relative;
		padding: 1.55rem 1.5rem 1.7rem;
		text-align: center;
	}
	.copy::before {
		position: absolute;
		top: 0;
		left: 50%;
		width: 4rem;
		height: 3px;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--coral), var(--mustard));
		content: '';
		transform: translateX(-50%);
	}
	h2 {
		margin: 0;
		color: var(--ink);
		font-size: clamp(1.45rem, 3vw, 2rem);
		font-weight: 700;
		letter-spacing: -0.035em;
	}
	p {
		max-width: 44rem;
		margin: 0.5rem auto 0;
		color: var(--ink-soft);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.waiting {
		display: flex;
		gap: 0.5rem;
	}
	.waiting span {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 999px;
		background: var(--coral);
		animation: bounce 900ms infinite alternate;
	}
	.waiting span:nth-child(2) {
		background: var(--mustard);
		animation-delay: 180ms;
	}
	.waiting span:nth-child(3) {
		background: var(--blue);
		animation-delay: 360ms;
	}
	@keyframes bounce {
		to {
			transform: translateY(-0.5rem);
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.waiting span {
			animation: none;
		}
	}
	@media (max-width: 600px) {
		.media,
		.media video {
			min-height: 17rem;
		}
		.copy {
			padding: 1.25rem;
		}
	}
</style>
