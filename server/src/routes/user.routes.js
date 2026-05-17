import { Router } from "express";
import { getMe, searchUsers } from "../controllers/user.controller.js";

const router = Router();

router.get("/me", getMe);
router.get("/search", searchUsers);

export default router;
