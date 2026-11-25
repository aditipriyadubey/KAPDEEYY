import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Clock, RotateCcw, Trash2, X } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";

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
    resetDaily,
  } = useNotifications();

  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) closeNotifications();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeNotifications]);

  if (!isOpen) return null;

  const handleItemClick = (item) => {
    markAsRead(item.id);
    if (item.actionPath) {
      closeNotifications();
      navigate(item.actionPath);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-200">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 -z-10"
        onClick={closeNotifications}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Daily Notifications"
        className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border-2 border-[#FCE4EC] flex flex-col max-h-[85vh] mt-12 sm:mt-0 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 pb-3.5 border-b border-[#F5E6EB] flex items-center justify-between shrink-0 bg-[#FFF7F9]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFEAEF] text-[#FF5C77] shadow-2xs">
              <Bell className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[#1F1D1E] leading-tight flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#FF5C77] text-white text-[10px] font-black px-2 py-0.5">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] font-bold text-[#8C7A82]">
                {unreadCount > 0 ? `${unreadCount} unread daily alerts` : "You're all caught up!"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] font-extrabold text-[#FF5C77] hover:underline px-2 py-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeNotifications}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-[#FCE4EC] text-black/50 hover:text-black hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Sub-toolbar */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-5 py-1.5 bg-[#FAF8F9] border-b border-[#F0EAEB] text-[11px]">
            <span className="text-black/45 font-bold">
              {notifications.length} daily alert{notifications.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 font-bold text-black/40 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear all</span>
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-3">
              <span className="text-4xl block">✨</span>
              <h3 className="font-extrabold text-[#1F1D1E] text-base">All caught up!</h3>
              <p className="text-xs text-black/55 max-w-xs mx-auto">
                No new daily notifications. Fresh outfit picks and styling advice arrive every morning!
              </p>
              <button
                type="button"
                onClick={resetDaily}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFEAEF] text-[#FF5C77] text-xs font-bold hover:bg-[#FFD9E3] transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restore daily alerts</span>
              </button>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`group relative cursor-pointer rounded-2xl p-3.5 transition-all flex gap-3 border ${
                  item.read
                    ? "bg-white border-[#F2ECEE] opacity-75 hover:opacity-100 hover:border-gray-300"
                    : "bg-[#FFF9FA] border-[#FFD6DF] shadow-2xs hover:shadow-xs"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-[#F2ECEE] text-2xl shadow-2xs shrink-0">
                  {item.iconType === "shirt" ? "👗" : item.iconType === "weather" ? "☀️" : "✨"}
                </span>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.badgeColor || "bg-pink-100 text-pink-700"}`}>
                      {item.category}
                    </span>
                    <span className="text-[10px] font-bold text-black/40 flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {item.time}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#1F1D1E] mt-1 truncate">
                    {item.title}
                  </h3>

                  <p className="text-xs text-black/65 font-semibold mt-0.5 leading-snug">
                    {item.message}
                  </p>

                  {item.actionPath && (
                    <span className="mt-1.5 inline-block text-[11px] font-extrabold text-[#FF5C77] hover:underline">
                      Tap to view →
                    </span>
                  )}
                </div>

                {/* Dismiss X */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(item.id);
                  }}
                  className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 rounded-full text-black/35 hover:text-black hover:bg-black/5 transition-all"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>

                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-[#FF5C77] shrink-0 mt-1" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FFF7F9] border-t border-[#F5E6EB] text-center">
          <p className="text-[11px] font-bold text-black/40">
            Daily outfit tips refreshed every morning ☀️
          </p>
        </div>
      </div>
    </div>
  );
}
