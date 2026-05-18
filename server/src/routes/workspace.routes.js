import { Router } from "express";
import {
	changeMemberRole,
	createWorkspace,
	deleteWorkspace,
	getMessages,
	getWorkspace,
	listActivity,
	listWorkspaces,
	removeMember,
	updateWorkspace,
} from "../controllers/workspace.controller.js";
import { listPendingInvites, revokeInvite, sendInvite } from "../controllers/invite.controller.js";
import { checkRole, checkWorkspaceMember } from "../middleware/checkRole.js";

const router = Router();

router.post("/", createWorkspace);
router.get("/", listWorkspaces);

router.use("/:workspaceId", checkWorkspaceMember);

router.get("/:workspaceId", getWorkspace);
router.patch("/:workspaceId", checkRole("admin"), updateWorkspace);
router.delete("/:workspaceId", checkRole("owner"), deleteWorkspace);
router.post("/:workspaceId/invite", checkRole("admin"), sendInvite);
router.get("/:workspaceId/invites", checkRole("admin"), listPendingInvites);
router.delete("/:workspaceId/invites/:inviteId", checkRole("admin"), revokeInvite);
router.patch("/:workspaceId/members/:userId", checkRole("admin"), changeMemberRole);
router.delete("/:workspaceId/members/:userId", checkRole("admin"), removeMember);
router.get("/:workspaceId/activity", listActivity);
router.get("/:workspaceId/messages", getMessages);

export default router;

