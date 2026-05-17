import { Router } from "express";
import {
	addAssignee,
	addComment,
	createTask,
	deleteComment,
	deleteTask,
	getTask,
	listComments,
	moveTask,
	removeAssignee,
	updateTask,
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
router.post("/:taskId/comments", addComment);
router.get("/:taskId/comments", listComments);
router.delete("/:taskId/comments/:commentId", deleteComment);

export default router;
