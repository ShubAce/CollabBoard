import { Router } from "express";
import { deleteNotification, listNotifications, markAllRead, markRead } from "../controllers/notification.controller.js";

const router = Router();

router.get("/", listNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:notificationId/read", markRead);
router.delete("/:notificationId", deleteNotification);

export default router;
