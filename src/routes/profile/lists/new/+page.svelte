<script lang="ts">
	import MovieListEditor from '$lib/components/MovieListEditor.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<MovieListEditor mode="create" {form} />
