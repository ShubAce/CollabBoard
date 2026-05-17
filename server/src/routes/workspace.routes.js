import { Router } from "express";
import {
	changeMemberRole,
	createWorkspace,
	deleteWorkspace,
	getWorkspace,
	inviteMember,
	listActivity,
	listWorkspaces,
	removeMember,
	updateWorkspace,
} from "../controllers/workspace.controller.js";
import { checkRole, checkWorkspaceMember } from "../middleware/checkRole.js";

const router = Router();

router.post("/", createWorkspace);
router.get("/", listWorkspaces);

router.use("/:workspaceId", checkWorkspaceMember);

router.get("/:workspaceId", getWorkspace);
router.patch("/:workspaceId", checkRole("admin"), updateWorkspace);
router.delete("/:workspaceId", checkRole("owner"), deleteWorkspace);
router.post("/:workspaceId/invite", checkRole("admin"), inviteMember);
router.patch("/:workspaceId/members/:userId", checkRole("admin"), changeMemberRole);
router.delete("/:workspaceId/members/:userId", checkRole("admin"), removeMember);
router.get("/:workspaceId/activity", listActivity);

export default router;
