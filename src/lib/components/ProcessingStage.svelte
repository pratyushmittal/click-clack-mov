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

	let { files, status, message, startedAt } = $props();
	let video = $state();
	let videoUrl = $state('');
	let mediaIndex = $state(0);
	let showingContactSheets = $state(false);
	let previousPhase = $state('');
	let latestToolEvent = $state('');
	let toolTitleIndex = $state(0);
	let now = $state(Date.now());

	let processingVideos = $derived(
		Object.values(status.processingVideos || {}).sort((left, right) => left.index - right.index)
	);
	let contactSheets = $derived(
		Object.entries(status.contactSheets || {}).sort(
			([left], [right]) => Number(left) - Number(right)
		)
	);
	let editing = $derived(status.phase === 'editing' || status.phase === 'finalizing');
	let processingVideo = $derived(
		processingVideos.length ? processingVideos[mediaIndex % processingVideos.length] : null
	);
	let mediaFileIndex = $derived(
		editing
			? showingContactSheets && contactSheets.length
				? Number(contactSheets[mediaIndex % contactSheets.length][0])
				: mediaIndex % Math.max(files.length, 1)
			: (processingVideo?.index ?? 0)
	);
	let mediaFile = $derived(files[mediaFileIndex]?.file);
	let contactSheetUrl = $derived(
		editing && showingContactSheets && contactSheets.length
			? contactSheets[mediaIndex % contactSheets.length][1]
			: ''
	);
	let newestEvent = $derived(status.events?.at(-1));
	let title = $derived.by(() => {
		if (status.phase === 'finalizing') return 'Finishing your movie';
		if (editing) {
			if (newestEvent) return toolTitles[toolTitleIndex];
			return showingContactSheets
				? 'Reviewing every camera roll'
				: 'Finding the shape of your story';
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
				: `Analyzing video ${processingVideo.index + 1} of ${files.length}: ${mediaFile.name}`
		} · ${timeLabel(elapsed)} elapsed`
	);

	$effect(() => {
		if (status.phase === previousPhase) return;
		previousPhase = status.phase;
		mediaIndex = 0;
		showingContactSheets = status.phase === 'editing';
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
		// Analysis keeps one source playing continuously; only editing uses the slideshow.
		if (!editing) return;

		if (showingContactSheets) {
			if (mediaIndex + 1 < contactSheets.length) mediaIndex += 1;
			else {
				showingContactSheets = false;
				mediaIndex = Math.floor(Math.random() * Math.max(files.length, 1));
			}
			return;
		}

		const count = files.length;
		if (count > 1) {
			const current = mediaIndex % count;
			const next = Math.floor(Math.random() * (count - 1));
			mediaIndex = next >= current ? next + 1 : next;
		} else if (video?.duration) {
			video.currentTime = Math.random() * Math.max(0, video.duration - 5);
		}
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
		if (!file || contactSheetUrl) {
			videoUrl = '';
			return;
		}
		const url = URL.createObjectURL(file);
		videoUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	function playPreview() {
		if (!video) return;
		video.playbackRate = editing ? 1.5 : 2;
		if (editing && video.duration)
			video.currentTime = Math.random() * Math.max(0, video.duration - 5);
		video.play().catch(() => {});
	}
</script>

<section class="processing-stage">
	<div class="media">
		{#if contactSheetUrl}
			<img
				src={contactSheetUrl}
				alt={`Timestamped contact sheet for ${mediaFile?.name || 'video'}`}
			/>
		{:else if videoUrl}
			<video
				bind:this={video}
				src={videoUrl}
				muted
				playsinline
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
	.media video,
	.media img {
		width: 100%;
		height: 100%;
		min-height: 24rem;
		max-height: 36rem;
		object-fit: contain;
		background: var(--ink);
	}
	.media video {
		object-fit: cover;
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
		.media video,
		.media img {
			min-height: 17rem;
		}
		.copy {
			padding: 1.25rem;
		}
	}
</style>
