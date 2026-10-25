import { resolveSchoolScene, type GradeSceneInput, type SchoolSceneId } from '$lib/school-scenes';

let sceneId = $state<SchoolSceneId>('6e');

export function connectedScene(): SchoolSceneId {
	return sceneId;
}

export function setConnectedGrade(input: GradeSceneInput | null): void {
	sceneId = input ? resolveSchoolScene(input) : '6e';
}
