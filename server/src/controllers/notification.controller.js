import Notification from "../models/Notification.js";

export const listNotifications = async (req, res, next) => {
	try {
		const page = Math.max(parseInt(req.query.page || "1", 10), 1);
		const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
		const unreadOnly = req.query.unreadOnly === "true";
		const skip = (page - 1) * limit;

		const filter = { recipient: req.user._id };
		if (unreadOnly) filter.isRead = false;

		const [notifications, total, unreadCount] = await Promise.all([
			Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
			Notification.countDocuments(filter),
			Notification.countDocuments({ recipient: req.user._id, isRead: false }),
		]);

		return res.status(200).json({
			notifications,
			unreadCount,
			totalPages: Math.ceil(total / limit),
		});
	} catch (err) {
		return next(err);
	}
};

export const markRead = async (req, res, next) => {
	try {
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.notificationId, recipient: req.user._id },
			{ isRead: true },
			{ new: true },
		);
		if (!notification) {
			return res.status(404).json({ message: "Notification not found" });
		}
		return res.status(200).json(notification);
	} catch (err) {
		return next(err);
	}
};

export const markAllRead = async (req, res, next) => {
	try {
		await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
		return res.status(200).json({ message: "All notifications marked as read" });
	} catch (err) {
		return next(err);
	}
};

export const deleteNotification = async (req, res, next) => {
	try {
		const notification = await Notification.findOneAndDelete({
			_id: req.params.notificationId,
			recipient: req.user._id,
		});
		if (!notification) {
			return res.status(404).json({ message: "Notification not found" });
		}
		return res.status(200).json({ message: "Notification deleted" });
	} catch (err) {
		return next(err);
	}
};
