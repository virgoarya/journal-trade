import { Router } from "express";
import { notificationService } from "../services/notification.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { z } from "zod";

const router = Router();

const createNotificationSchema = z.object({
  type: z.enum(["AI_REVIEW_READY", "TRADE_LOGGED", "RISK_WARNING", "SYSTEM"]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(500),
  link: z.string().url().optional().nullable(),
  metadata: z.any().optional(),
});

router.use(requireAuth);

// GET /notifications - fetch recent notifications
router.get("/", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const unreadOnly = req.query.unreadOnly === "true";

    const notifications = await notificationService.getRecent(
      req.user.id,
      limit,
      unreadOnly
    );

    return apiResponse.success(res, notifications);
  } catch (error) { next(error); }
});

// GET /notifications/unread-count - count unread notifications
router.get("/unread-count", async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return apiResponse.success(res, { count });
  } catch (error) { next(error); }
});

// POST /notifications - create notification (internal use)
router.post("/", validate({ body: createNotificationSchema }), async (req, res, next) => {
  try {
    const notification = await notificationService.create({
      ...req.body,
      userId: req.user.id,
    });
    return apiResponse.success(res, notification, 201);
  } catch (error) { next(error); }
});

// PUT /notifications/:id/read - mark as read
router.put("/:id/read", async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id as string,
      req.user.id
    );
    if (!notification) {
      return apiResponse.notFound(res, "Notification not found");
    }
    return apiResponse.success(res, notification);
  } catch (error) { next(error); }
});

// PUT /notifications/read-all - mark all as read
router.put("/read-all", async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    return apiResponse.success(res, { message: "All notifications marked as read" });
  } catch (error) { next(error); }
});

// DELETE /notifications/:id - delete notification
router.delete("/:id", async (req, res, next) => {
  try {
    const result = await notificationService.delete(req.params.id as string, req.user.id);
    if (!result) {
      return apiResponse.notFound(res, "Notification not found");
    }
    return apiResponse.success(res, { message: "Notification deleted" });
  } catch (error) { next(error); }
});

export default router;
