<script lang="ts">
	import '../app.css';
	import { navigating } from '$app/state';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';

	let { children } = $props();
	const loading = $derived(navigating.to !== null);
</script>

{@render children()}
<LoadingOverlay visible={loading} />
