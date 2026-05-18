import { Router } from "express";
import { changePassword, getMe, searchUsers, updateMe } from "../controllers/user.controller.js";

const router = Router();

router.get("/me", getMe);
router.patch("/me", updateMe);
router.patch("/me/password", changePassword);
router.get("/search", searchUsers);

export default router;
