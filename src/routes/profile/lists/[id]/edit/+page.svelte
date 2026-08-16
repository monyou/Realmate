<script lang="ts">
	import MovieListEditor from '$lib/components/MovieListEditor.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<MovieListEditor
	mode="edit"
	{form}
	initialName={data.list.name}
	initialDescription={data.list.description}
	initialItems={data.list.items}
	expectedUpdatedAt={data.list.updatedAt}
/>
