import { Router } from "express";
import {
	addColumn,
	createBoard,
	deleteBoard,
	deleteColumn,
	getBoardWithTasks,
	listBoards,
	reorderColumns,
	updateBoard,
	updateColumn,
} from "../controllers/board.controller.js";
import { checkRole } from "../middleware/checkRole.js";

const router = Router({ mergeParams: true });

router.post("/", checkRole("editor"), createBoard);
router.get("/", listBoards);
router.get("/:boardId", getBoardWithTasks);
router.patch("/:boardId", checkRole("editor"), updateBoard);
router.delete("/:boardId", checkRole("admin"), deleteBoard);
router.post("/:boardId/columns", checkRole("editor"), addColumn);
router.patch("/:boardId/columns/:columnId", checkRole("editor"), updateColumn);
router.delete("/:boardId/columns/:columnId", checkRole("editor"), deleteColumn);
router.patch("/:boardId/columns/reorder", checkRole("editor"), reorderColumns);

export default router;
