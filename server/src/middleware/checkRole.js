import Workspace from "../models/Workspace.js";

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export const checkWorkspaceMember = async (req, res, next) => {
	const workspaceId = req.params.workspaceId;
	if (!workspaceId) {
		return res.status(400).json({ message: "Workspace id is required" });
	}

	const workspace = await Workspace.findById(workspaceId);
	if (!workspace) {
		return res.status(404).json({ message: "Workspace not found" });
	}

	const member = workspace.members.find((entry) => entry.user.toString() === req.user._id.toString());
	if (!member) {
		return res.status(403).json({ message: "Not a workspace member" });
	}

	req.workspace = workspace;
	req.memberRole = member.role;
	next();
};

export const checkRole = (minRole) => (req, res, next) => {
	const currentRole = req.memberRole || "viewer";
	if (ROLE_RANK[currentRole] < ROLE_RANK[minRole]) {
		return res.status(403).json({ message: `Requires ${minRole} role or higher` });
	}
	next();
};
