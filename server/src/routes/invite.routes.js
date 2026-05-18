import { Router } from "express";
import {
	acceptInvite,
	acceptInviteAndRegister,
	previewInvite,
} from "../controllers/invite.controller.js";
import { attachUserIfPresent } from "../middleware/auth.js";

const router = Router();

router.get("/preview", attachUserIfPresent, previewInvite);
router.post("/accept", attachUserIfPresent, acceptInvite);
router.post("/accept-register", acceptInviteAndRegister);

export default router;
