import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import passport from "passport";

const router = Router();

router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/logout", authenticateToken, auth.logout);
router.post("/refresh", auth.refresh);
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), auth.googleCallback);

export default router;