import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { loadRecent, rememberRoom, roomLabel, slugify, type RecentRoom } from "@/lib/rooms";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/orbit/mark";
import { Calendar as CalendarIcon, Clock, Loader2, LogOut, Mic, PhoneOff, RefreshCw, Video } from "lucide-react";
import { Eq, initials } from "@/components/orbit/tile";
import { GoogleSignInButton } from "@/components/orbit/calendar-panel";
import { initGoogleAuth, googleSignIn, googleSignOut } from "@/lib/google-calendar/auth";
import { listUpcomingEvents, formatEventDateTime, parseOrbitMeetingUrl, type CalendarEvent } from "@/lib/google-calendar/client";
import type { User } from "firebase/auth";

const PREVIEW = [
  { name: "Maya Chen", speaking: true },
  { name: "Leo Okonkwo", speaking: false },
  { name: "Priya Shah", speaking: false },
  { name: "You", speaking: false },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState<RecentRoom[] | null>(null);

  // Google Calendar state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    const unsub = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!googleToken) {
      setUpcomingEvents([]);
      return;
    }
    setEventsLoading(true);
    listUpcomingEvents(googleToken, "primary", 5)
      .then((items) => setUpcomingEvents(items))
      .catch(() => setUpcomingEvents([]))
      .finally(() => setEventsLoading(false));
  }, [googleToken]);

  function start(raw: string) {
    const slug = slugify(raw);
    setRecent(rememberRoom(slug));
    void navigate({ to: "/meet/$room", params: { room: slug } });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    start(draft);
  }

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch {
      // login error
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex h-16 items-center justify-between border-b border-line px-5">
        <Wordmark />
        <div className="flex items-center gap-3">
          {googleUser ? (
            <div className="flex items-center gap-2 rounded-full border border-line bg-elevated px-2.5 py-1 text-xs">
              <span className="size-2 rounded-full bg-live" />
              <span className="max-w-[120px] truncate font-medium sm:max-w-[180px]">
                {googleUser.displayName || googleUser.email}
              </span>
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="text-muted hover:text-danger ml-1"
                title="Sign out of Google Calendar"
              >
                <LogOut className="size-3" />
              </button>
            </div>
          ) : (
            <p className="hidden text-sm text-muted sm:block">No account required</p>
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 lg:grid-cols-2 lg:items-start lg:gap-16 lg:py-16">
        <section>
          <p className="text-sm font-medium text-muted">Video meetings</p>
          <h1 className="mt-2 max-w-xl text-3xl font-medium tracking-tight text-fg sm:text-4xl">
            Secure, high-quality meetings
          </h1>
          <p className="mt-3 max-w-lg text-base leading-normal text-muted">
            Start a room, share the name, and meet in the browser. No account and no install. You moderate what you start.
          </p>

          <form onSubmit={onSubmit} className="mt-8 rounded-card border border-line bg-elevated p-4">
            <label htmlFor="meeting-name" className="text-sm font-medium text-fg">
              Meeting name
            </label>
            <input
              id="meeting-name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="design-review"
              autoComplete="off"
              className="mt-2 h-12 w-full rounded-md border border-strong bg-bg px-3 text-base text-fg outline-none placeholder:text-faint"
            />
            <Button type="submit" variant="primary" size="lg" className="mt-3 w-full">
              Start meeting
            </Button>
            <p className="mt-3 text-sm text-faint">
              Leave it blank and a name is chosen for you. You are the only moderator.
            </p>
          </form>

          <section className="mt-8" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="text-sm font-medium text-muted">
              Recent Rooms
            </h2>
            {recent === null ? (
              <p className="mt-3 text-sm text-faint">Loading recent rooms</p>
            ) : recent.length === 0 ? (
              <p className="mt-3 max-w-md text-sm leading-normal text-muted">
                No recent rooms yet. Start one and it stays on this device.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {recent.map((room) => (
                  <li key={room.slug} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium capitalize">{roomLabel(room.slug)}</p>
                      <p className="truncate text-sm text-faint">{room.slug}</p>
                    </div>
                    <Button variant="secondary" onClick={() => start(room.slug)}>
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        {/* Right side: Google Calendar Integration Card & Meeting Preview */}
        <section className="space-y-6">
          {/* Google Calendar Hub */}
          <div className="rounded-card border border-line bg-elevated p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-5 text-accent" />
                <h3 className="text-sm font-semibold">Google Calendar</h3>
              </div>
              {googleUser && (
                <button
                  type="button"
                  onClick={() => {
                    if (googleToken) {
                      setEventsLoading(true);
                      listUpcomingEvents(googleToken, "primary", 5)
                        .then((items) => setUpcomingEvents(items))
                        .finally(() => setEventsLoading(false));
                    }
                  }}
                  className="rounded p-1 text-muted hover:text-fg"
                  title="Refresh events"
                >
                  <RefreshCw className={`size-3.5 ${eventsLoading ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {!googleUser ? (
              <div className="space-y-3 rounded-lg border border-line bg-subtle p-4">
                <p className="text-xs text-muted leading-relaxed">
                  Connect your Google Calendar to view upcoming appointments and launch instant Orbit video meetings with one click.
                </p>
                <GoogleSignInButton onClick={handleGoogleLogin} loading={authLoading} label="Sign in with Google Calendar" />
              </div>
            ) : (
              <div className="space-y-2.5">
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted">
                    <Loader2 className="size-4 animate-spin text-accent mr-2" />
                    Loading upcoming meetings…
                  </div>
                ) : upcomingEvents.length === 0 ? (
                  <p className="py-3 text-xs text-muted text-center">No upcoming events found on your Google Calendar.</p>
                ) : (
                  upcomingEvents.map((evt) => {
                    const orbitUrl = parseOrbitMeetingUrl(evt.location) || parseOrbitMeetingUrl(evt.description);
                    const targetSlug = orbitUrl
                      ? orbitUrl.split("/meet/")[1] || "meeting"
                      : (evt.summary || "meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-");

                    return (
                      <div
                        key={evt.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line bg-subtle p-2.5 transition-colors hover:border-strong"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-fg">{evt.summary || "Scheduled Event"}</p>
                          <p className="truncate text-[11px] text-faint flex items-center gap-1 mt-0.5">
                            <Clock className="size-3 shrink-0" />
                            <span>{formatEventDateTime(evt)}</span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 shrink-0 text-xs gap-1 font-medium"
                          onClick={() => start(targetSlug)}
                        >
                          <Video className="size-3" />
                          <span>Meet</span>
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Orbit UI Preview */}
          <div className="rounded-card border border-line bg-elevated p-3">
            <div className="mb-3 flex items-center justify-between px-1 text-sm text-muted">
              <span>design-review</span>
              <span className="tabular-nums">12:04</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PREVIEW.map((person) => (
                <div
                  key={person.name}
                  className={`relative flex h-32 items-center justify-center rounded-lg border-2 bg-subtle ${person.speaking ? "border-accent" : "border-transparent"}`}
                >
                  <span className="text-xl font-medium">
                    {initials(person.name === "You" ? "Alex Morgan" : person.name)}
                  </span>
                  {person.speaking && (
                    <span className="absolute right-2 top-2 rounded-sm bg-bg/80 px-1.5 py-1">
                      <Eq />
                    </span>
                  )}
                  <span className="absolute inset-x-2 bottom-2 truncate rounded-sm bg-bg/80 px-2 py-1 text-xs">
                    {person.name}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-2 text-fg">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-subtle">
                <Mic className="size-3.5" />
              </span>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-subtle">
                <Video className="size-3.5" />
              </span>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-danger text-danger-fg">
                <PhoneOff className="size-3.5" />
              </span>
            </div>
          </div>
        </section>
      </main>

      <section className="mx-auto grid w-full max-w-6xl gap-px bg-line px-5 pb-16 sm:grid-cols-3">
        {[
          ["No account required", "Join with a display name or connect Google Calendar to schedule calls."],
          ["You run the room", "Mute everyone, hold guests in the lobby, or end it when you're done."],
          ["Google Calendar Sync", "Create events with Orbit meeting links directly in your Google Calendar."],
        ].map(([title, copy]) => (
          <div key={title} className="bg-bg py-5 sm:px-4">
            <h2 className="text-sm font-medium text-fg">{title}</h2>
            <p className="mt-1 text-sm leading-normal text-muted">{copy}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
