export type CalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
};

export type CalendarEventTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type CalendarEventAttendee = {
  email: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
  self?: boolean;
};

export type CalendarEvent = {
  id: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: CalendarEventTime;
  end?: CalendarEventTime;
  attendees?: CalendarEventAttendee[];
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
      label?: string;
    }>;
  };
};

export async function listUserCalendars(accessToken: string): Promise<CalendarListEntry[]> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fetch Google Calendar list.");
  }

  const data = (await response.json()) as { items?: CalendarListEntry[] };
  return data.items || [];
}

export async function listUpcomingEvents(
  accessToken: string,
  calendarId = "primary",
  maxResults = 25,
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fetch Google Calendar events.");
  }

  const data = (await response.json()) as { items?: CalendarEvent[] };
  return data.items || [];
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startIso: string;
    endIso: string;
    attendees?: string[];
  },
): Promise<CalendarEvent> {
  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startIso,
    },
    end: {
      dateTime: event.endIso,
    },
  };

  if (event.attendees && event.attendees.length > 0) {
    body.attendees = event.attendees.map((email) => ({ email: email.trim() }));
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create Google Calendar event.");
  }

  return (await response.json()) as CalendarEvent;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to delete Google Calendar event.");
  }
}

export function parseOrbitMeetingUrl(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function formatEventDateTime(event: CalendarEvent): string {
  const startRaw = event.start?.dateTime || event.start?.date;
  if (!startRaw) return "Time not set";

  const isAllDay = !event.start?.dateTime;
  const start = new Date(startRaw);

  if (isAllDay) {
    return start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const endRaw = event.end?.dateTime;
  const end = endRaw ? new Date(endRaw) : null;

  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const startTimeStr = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (end) {
    const endTimeStr = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateStr}, ${startTimeStr} – ${endTimeStr}`;
  }

  return `${dateStr} at ${startTimeStr}`;
}
