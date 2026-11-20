<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const title = 'Vizard for Letterboxd';
	const description =
		'Drop your Letterboxd export and see your film history as maps, charts, a poster wall and a year in review.';
	const image = $derived(`${page.url.origin}/og-image.jpg`);
</script>

<svelte:head>
	<link rel="icon" href="/vizard-icon.svg" />
	<meta name="description" content={description} />
	<meta name="theme-color" content="#fe640b" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={title} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={page.url.origin} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="Vizard stats and a world map of watched films"
	/>
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

{@render children()}
