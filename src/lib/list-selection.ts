export const selectionAfterDelete = (
	selectedListIds: string[],
	deletedListId: string,
	succeeded: boolean
) =>
	succeeded
		? selectedListIds.filter((selectedListId) => selectedListId !== deletedListId)
		: selectedListIds;
