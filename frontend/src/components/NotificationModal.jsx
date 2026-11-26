import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Clock,
  Layers,
  Shirt,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useNotifications } from "../context/NotificationContext";

function NotificationIcon({ type }) {
  const Icon = type === "shirt" ? Shirt : type === "weather" ? Sun : Layers;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-ink-soft">
      <Icon className="h-4 w-4" strokeWidth={1.8} />
    </span>
  );
}

export default function NotificationModal() {
  const {
    notifications,
    unreadCount,
    isOpen,
    closeNotifications,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  } = useNotifications();

  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) closeNotifications();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeNotifications]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleItemClick = (item) => {
    markAsRead(item.id);
    if (item.actionPath) {
      closeNotifications();
      navigate(item.actionPath);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={closeNotifications}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="relative mt-10 flex max-h-[85vh] w-full max-w-md animate-slide-up flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lift sm:mt-0"
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink">
              <Bell className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              <p className="text-[11px] text-ink-faint">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] font-medium text-ink-soft hover:text-ink"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark read
              </button>
            )}
            <button
              type="button"
              onClick={closeNotifications}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center justify-between border-b border-line bg-canvas px-4 py-1.5 text-[11px]">
            <span className="text-ink-faint">
              {notifications.length} notification
              {notifications.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 font-medium text-ink-faint hover:text-danger"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.6} />
              <h3 className="mt-4 text-sm font-semibold text-ink">
                No notifications
              </h3>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-soft">
                Outfit and wardrobe updates will appear here when there is
                something new.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((item) => (
                <li key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => e.key === "Enter" && handleItemClick(item)}
                    className={`group relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                      item.read
                        ? "border-line bg-surface hover:border-ink/25"
                        : "border-line bg-canvas"
                    }`}
                  >
                    <NotificationIcon type={item.iconType} />

                    <div className="min-w-0 flex-1 pr-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                          {item.category}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-ink-faint">
                          <Clock className="h-3 w-3" />
                          {item.time}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-sm font-semibold text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-xs leading-snug text-ink-soft">
                        {item.message}
                      </p>
                      {item.actionPath && (
                        <span className="mt-1.5 inline-block text-[11px] font-medium text-accent">
                          View →
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(item.id);
                      }}
                      className="absolute right-2 top-2 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>

                    {!item.read && (
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
