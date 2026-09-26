import { useEffect, useState, type FormEvent } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Video,
  AlertTriangle,
  CheckCircle2,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
} from "@/lib/google-calendar/auth";
import {
  listUserCalendars,
  listUpcomingEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  formatEventDateTime,
  parseOrbitMeetingUrl,
  type CalendarEvent,
  type CalendarListEntry,
} from "@/lib/google-calendar/client";
import type { User } from "firebase/auth";

export function GoogleSignInButton({
  onClick,
  loading = false,
  label = "Sign in with Google",
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-strong bg-white px-4 font-sans text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 active:scale-[0.99] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin text-neutral-600" />
      ) : (
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          className="size-5 shrink-0"
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}

export function CalendarPanel({
  currentRoom,
  onJoinRoom,
}: {
  currentRoom?: string;
  onJoinRoom?: (roomName: string) => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"events" | "schedule">("events");

  // Calendars and events state
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("primary");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Schedule form state
  const [title, setTitle] = useState(currentRoom ? `Orbit Meeting: ${currentRoom}` : "Orbit Video Call");
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0] || "";
  });
  const [timeStr, setTimeStr] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [attendeesInput, setAttendeesInput] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState<CalendarEvent | null>(null);

  // Delete confirmation modal state (Required for destructive operations)
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setError(null);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setAccessToken(null);
    setEvents([]);
    setCalendars([]);
  };

  const fetchCalendarsAndEvents = async (token = accessToken, calId = selectedCalendarId) => {
    if (!token) return;
    setEventsLoading(true);
    setError(null);
    try {
      const [cals, evts] = await Promise.all([
        listUserCalendars(token).catch(() => []),
        listUpcomingEvents(token, calId),
      ]);
      setCalendars(cals);
      setEvents(evts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google Calendar data.");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      void fetchCalendarsAndEvents(accessToken, selectedCalendarId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedCalendarId]);

  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    if (!title.trim()) {
      setError("Please provide a meeting title.");
      return;
    }

    setScheduleLoading(true);
    setError(null);
    setScheduleSuccess(null);

    try {
      const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
      if (isNaN(startDateTime.getTime())) {
        throw new Error("Invalid start date or time.");
      }

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

      const targetRoom = currentRoom || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "meeting";
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const orbitUrl = `${origin}/meet/${targetRoom}`;

      const fullDescription = [
        description.trim(),
        "",
        `Join Orbit Video Meeting: ${orbitUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

      const attendeeEmails = attendeesInput
        .split(/[,;\s]+/)
        .map((email) => email.trim())
        .filter((email) => email.includes("@"));

      const created = await createCalendarEvent(accessToken, selectedCalendarId, {
        summary: title.trim(),
        description: fullDescription,
        location: orbitUrl,
        startIso: startDateTime.toISOString(),
        endIso: endDateTime.toISOString(),
        attendees: attendeeEmails,
      });

      setScheduleSuccess(created);
      void fetchCalendarsAndEvents(accessToken, selectedCalendarId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule event.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!accessToken || !deletingEvent) return;
    setIsDeleting(true);
    try {
      await deleteCalendarEvent(accessToken, selectedCalendarId, deletingEvent.id);
      setEvents((prev) => prev.filter((ev) => ev.id !== deletingEvent.id));
      setDeletingEvent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-elevated text-fg">
      {/* Auth state header */}
      <div className="border-b border-line p-4">
        {!user || !accessToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-5 text-accent" />
              <div>
                <h3 className="text-sm font-semibold">Google Calendar</h3>
                <p className="text-xs text-muted">
                  Connect to view and schedule Orbit video meetings directly on your calendar with your permission.
                </p>
              </div>
            </div>
            <GoogleSignInButton onClick={handleSignIn} loading={authLoading} label="Sign in with Google" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Google user"}
                    className="size-8 rounded-full border border-strong"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-subtle text-xs font-semibold uppercase">
                    {(user.displayName || user.email || "G")[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{user.displayName || "Google Account"}</p>
                  <p className="truncate text-[11px] text-faint">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted hover:text-fg"
                  title="Refresh calendar"
                  onClick={() => fetchCalendarsAndEvents()}
                  disabled={eventsLoading}
                >
                  <RefreshCw className={`size-3.5 ${eventsLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted hover:text-danger"
                  title="Sign out of Google"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Calendar Selector */}
            {calendars.length > 1 && (
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-faint" htmlFor="calendar-select">
                  Active Calendar
                </label>
                <select
                  id="calendar-select"
                  value={selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-line bg-bg px-2 text-xs text-fg outline-none"
                >
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary} {cal.primary ? "(Primary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex rounded-lg border border-line bg-bg p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTab("events")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
                  tab === "events" ? "bg-elevated text-fg shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                <CalendarIcon className="size-3.5" />
                <span>Upcoming</span>
                {events.length > 0 && (
                  <span className="rounded-full bg-subtle px-1.5 py-0.2 text-[10px] text-faint">
                    {events.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("schedule");
                  setScheduleSuccess(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
                  tab === "schedule" ? "bg-elevated text-fg shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                <CalendarPlus className="size-3.5" />
                <span>Schedule Call</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="m-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        {!user || !accessToken ? (
          <div className="rounded-xl border border-line bg-subtle p-5 text-center space-y-3">
            <CalendarIcon className="size-8 text-muted mx-auto" />
            <h4 className="text-sm font-semibold">Integrate Google Calendar</h4>
            <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto">
              Sign in with your Google account to seamlessly schedule Orbit meetings, invite participants, and open upcoming calls.
            </p>
          </div>
        ) : tab === "events" ? (
          <div className="space-y-3">
            {eventsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
                <Loader2 className="size-6 animate-spin text-accent" />
                <p className="mt-2 text-xs">Loading upcoming events…</p>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-xl border border-line bg-subtle p-6 text-center space-y-2">
                <CalendarIcon className="size-6 text-muted mx-auto" />
                <p className="text-xs text-muted">No upcoming events scheduled on this calendar.</p>
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2"
                  onClick={() => setTab("schedule")}
                >
                  <Plus className="size-3.5 mr-1" />
                  Schedule Orbit Meeting
                </Button>
              </div>
            ) : (
              events.map((event) => {
                const orbitUrl = parseOrbitMeetingUrl(event.location) || parseOrbitMeetingUrl(event.description);
                const hasAttendees = event.attendees && event.attendees.length > 0;

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-line bg-subtle p-3.5 space-y-2.5 transition-colors hover:border-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-fg truncate">
                          {event.summary || "Untitled Event"}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted">
                          <Clock className="size-3 text-faint shrink-0" />
                          <span>{formatEventDateTime(event)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted hover:text-fg"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeletingEvent(event)}
                          className="rounded p-1 text-muted hover:text-danger"
                          title="Delete event"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Attendees badge */}
                    {hasAttendees && (
                      <div className="flex items-center gap-1.5 text-[11px] text-faint">
                        <Users className="size-3 shrink-0" />
                        <span className="truncate">
                          {event.attendees?.map((a) => a.displayName || a.email).join(", ")}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="pt-1 flex items-center gap-2">
                      {orbitUrl ? (
                        <a
                          href={orbitUrl}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-white"
                        >
                          <Video className="size-3.5" />
                          <span>Join Orbit Call</span>
                        </a>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full text-xs"
                          onClick={() => {
                            if (onJoinRoom && event.summary) {
                              onJoinRoom(event.summary.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                            }
                          }}
                        >
                          <Video className="size-3.5 mr-1" />
                          Start Meeting for this Event
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Schedule Form */
          <form onSubmit={handleCreateEvent} className="space-y-3.5">
            {scheduleSuccess && (
              <div className="rounded-lg border border-live/40 bg-live/10 p-3 text-xs text-live flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Event created on Google Calendar!</p>
                  {scheduleSuccess.htmlLink && (
                    <a
                      href={scheduleSuccess.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs underline font-medium text-fg hover:text-accent"
                    >
                      View in Google Calendar <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-fg" htmlFor="event-title">
                Meeting Title
              </label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product Sync & Review"
                className="mt-1 h-9 w-full rounded-md border border-strong bg-bg px-3 text-xs text-fg outline-none placeholder:text-faint focus:border-accent"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-fg" htmlFor="event-date">
                  Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-strong bg-bg px-2 text-xs text-fg outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-fg" htmlFor="event-time">
                  Start Time
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-strong bg-bg px-2 text-xs text-fg outline-none focus:border-accent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-fg">Duration</label>
              <div className="mt-1 grid grid-cols-4 gap-1.5">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`rounded-md py-1.5 text-xs font-medium border transition-colors ${
                      durationMinutes === mins
                        ? "border-accent bg-accent text-ink"
                        : "border-line bg-bg text-muted hover:text-fg"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-fg" htmlFor="event-attendees">
                Invite Attendees (comma-separated emails)
              </label>
              <input
                id="event-attendees"
                type="text"
                value={attendeesInput}
                onChange={(e) => setAttendeesInput(e.target.value)}
                placeholder="colleague@company.com, team@orbit.app"
                className="mt-1 h-9 w-full rounded-md border border-strong bg-bg px-3 text-xs text-fg outline-none placeholder:text-faint focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-fg" htmlFor="event-desc">
                Agenda / Notes (Optional)
              </label>
              <textarea
                id="event-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Discuss Q3 goals and roadmap updates…"
                rows={2}
                className="mt-1 w-full rounded-md border border-strong bg-bg p-2.5 text-xs text-fg outline-none placeholder:text-faint focus:border-accent"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              disabled={scheduleLoading}
            >
              {scheduleLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Adding to Calendar…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CalendarPlus className="size-4" /> Add to Google Calendar
                </span>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Mandatory User Confirmation Modal for Destructive Operations (Deleting an Event) */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-line bg-elevated p-5 shadow-panel space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg">Delete Calendar Event?</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Are you sure you want to delete{" "}
                  <strong className="text-fg">&ldquo;{deletingEvent.summary || "this event"}&rdquo;</strong>{" "}
                  from your Google Calendar? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingEvent(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : "Delete Event"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
