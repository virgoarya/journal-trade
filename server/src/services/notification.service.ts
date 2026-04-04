import { Notification } from "../models/Notification";

export const notificationService = {

  async getRecent(userId: string, limit = 10, unreadOnly = false) {
    const query: any = { userId };
    if (unreadOnly) {
      query.read = false;
    }

    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  async getUnreadCount(userId: string) {
    return await Notification.countDocuments({ userId, read: false });
  },

  async markAsRead(notificationId: string, userId: string) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { read: true } },
      { returnDocument: 'after' }
    );
  },

  async markAllAsRead(userId: string) {
    return await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );
  },

  async create(data: {
    userId: string;
    type: "AI_REVIEW_READY" | "TRADE_LOGGED" | "RISK_WARNING" | "SYSTEM";
    title: string;
    message: string;
    link?: string;
    metadata?: any;
  }) {
    return await Notification.create({
      ...data,
      read: false
    });
  },

  async delete(notificationId: string, userId: string) {
    return await Notification.deleteOne({ _id: notificationId, userId });
  },

  async deleteAll(userId: string) {
    return await Notification.deleteMany({ userId });
  }
};

export default notificationService;
