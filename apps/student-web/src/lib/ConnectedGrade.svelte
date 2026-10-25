<script lang="ts">
	import { setConnectedGrade } from '$lib/grade-scene.svelte';
	import type { HomePayload } from '$lib/types';

	let { home }: { home: Promise<Pick<HomePayload, 'student'>> } = $props();

	$effect(() => {
		const pending = home;
		let current = true;
		void pending.then((value) => {
			if (!current) return;
			setConnectedGrade({
				gradeLevel: value.student.gradeLevel,
				classLabel: value.student.classLabel,
			});
		});
		return () => {
			current = false;
			setConnectedGrade(null);
		};
	});
</script>
