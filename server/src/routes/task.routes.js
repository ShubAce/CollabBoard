import { Router } from "express";
import {
	addAssignee,
	addComment,
	addDependency,
	addSubTask,
	createTask,
	deleteComment,
	deleteSubTask,
	deleteTask,
	getTask,
	listComments,
	moveTask,
	removeDependency,
	removeAssignee,
	updateTask,
	updateSubTask,
} from "../controllers/task.controller.js";
import { checkRole } from "../middleware/checkRole.js";

const router = Router({ mergeParams: true });

router.post("/", checkRole("editor"), createTask);
router.get("/:taskId", getTask);
router.patch("/:taskId", checkRole("editor"), updateTask);
router.delete("/:taskId", checkRole("editor"), deleteTask);
router.patch("/:taskId/move", checkRole("editor"), moveTask);
router.post("/:taskId/assignees", checkRole("editor"), addAssignee);
router.delete("/:taskId/assignees/:userId", checkRole("editor"), removeAssignee);
router.post("/:taskId/subtasks", checkRole("editor"), addSubTask);
router.patch("/:taskId/subtasks/:subTaskId", checkRole("editor"), updateSubTask);
router.delete("/:taskId/subtasks/:subTaskId", checkRole("editor"), deleteSubTask);
router.post("/:taskId/dependencies", checkRole("editor"), addDependency);
router.post("/:taskId/dependencies/remove", checkRole("editor"), removeDependency);
router.post("/:taskId/comments", addComment);
router.get("/:taskId/comments", listComments);
router.delete("/:taskId/comments/:commentId", deleteComment);

export default router;
