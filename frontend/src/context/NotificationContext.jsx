import { createContext, useContext, useEffect, useState } from "react";

const NotificationContext = createContext(null);

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notif-1",
    category: "Today's Outfit",
    title: "Casual Autumn is styled for you!",
    message: "Soft cream cardigan paired with straight denim and white sneakers. Tap to view your look.",
    time: "8:00 AM",
    read: false,
    badgeColor: "bg-[#D7F0DC] text-[#124C27]",
    iconType: "shirt",
    actionPath: "/",
  },
  {
    id: "notif-2",
    category: "Weather & Style",
    title: "Sunny & 22°C outside",
    message: "Brisk morning weather! Perfect for lightweight knitwear and breezy layering.",
    time: "9:15 AM",
    read: false,
    badgeColor: "bg-[#BAE6FD] text-[#0369A1]",
    iconType: "weather",
  },
  {
    id: "notif-3",
    category: "Wardrobe Remix",
    title: "Time to remix your denim!",
    message: "You haven't worn your Blue Straight-Leg Jeans in 14 days. We put together fresh combinations for it.",
    time: "11:30 AM",
    read: false,
    badgeColor: "bg-[#FFEAEF] text-[#FF5C77]",
    iconType: "sparkles",
    actionPath: "/studio",
  },
  {
    id: "notif-4",
    category: "New Pairing",
    title: "3 fresh matches discovered",
    message: "AI Stylist matched your Black Fitted Tee with 3 autumn jackets in your closet.",
    time: "Yesterday",
    read: true,
    badgeColor: "bg-[#FFF4CC] text-[#92400E]",
    iconType: "sparkles",
    actionPath: "/studio",
  },
];

const STORAGE_KEY = "kapdeeyy_notifications_v1";

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.error("Failed to persist notifications", e);
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const resetDaily = () => {
    setNotifications(DEFAULT_NOTIFICATIONS);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        openNotifications: () => setIsOpen(true),
        closeNotifications: () => setIsOpen(false),
        markAsRead,
        markAllAsRead,
        dismiss,
        clearAll,
        resetDaily,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
