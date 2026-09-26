import { getLiveTranslateToken } from "@/lib/gemini-live";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveTranslateClient,
  type TranscriptLine,
} from "@/lib/translate/live-translate-client";

export type TranslationStatus = "idle" | "connecting" | "listening" | "playing" | "error";

export type TranslationSource = "meeting" | "microphone" | "screen";

export type TranslationState = {
  status: TranslationStatus;
  sourceText: string;
  translatedText: string;
  error: string | null;
  inputLevel: number;
  speakerMuted: boolean;
};

const INITIAL_STATE: TranslationState = {
  status: "idle",
  sourceText: "",
  translatedText: "",
  error: null,
  inputLevel: 0,
  speakerMuted: false,
};

function lastLineText(lines: TranscriptLine[], role: "source" | "translation"): string {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line && line.role === role && line.text) return line.text;
  }
  return "";
}

export function useLiveTranslation({
  stream,
  enabled,
  targetLanguageCode,
  source = "meeting",
  speakerMuted = false,
}: {
  stream?: MediaStream | null;
  enabled: boolean;
  targetLanguageCode: string;
  source?: TranslationSource;
  speakerMuted?: boolean;
}) {
  const [state, setState] = useState<TranslationState>(INITIAL_STATE);
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [attempt, setAttempt] = useState(0);
  const clientRef = useRef<LiveTranslateClient | null>(null);
  const playingTimer = useRef<number | null>(null);

  const restart = useCallback(() => {
    if (playingTimer.current !== null) {
      window.clearTimeout(playingTimer.current);
      playingTimer.current = null;
    }
    void clientRef.current?.stop("idle");
    clientRef.current = null;
    setState((prev) => ({ ...INITIAL_STATE, speakerMuted: prev.speakerMuted }));
    setAttempt((value) => value + 1);
  }, []);

  const setSpeakerMuted = useCallback((muted: boolean) => {
    setState((prev) => ({ ...prev, speakerMuted: muted }));
    clientRef.current?.setSpeakerMuted(muted);
  }, []);

  const clearHistory = useCallback(() => {
    setTranscripts([]);
    setState((prev) => ({ ...prev, sourceText: "", translatedText: "" }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL_STATE);
      return;
    }

    const language = targetLanguageCode;
    let cancelled = false;

    function markPlaying() {
      setState((current) => (current.status === "playing" ? current : { ...current, status: "playing" }));
      if (playingTimer.current !== null) window.clearTimeout(playingTimer.current);
      playingTimer.current = window.setTimeout(() => {
        playingTimer.current = null;
        if (!cancelled) {
          setState((current) => (current.status === "playing" ? { ...current, status: "listening" } : current));
        }
      }, 3000);
    }

    async function start() {
      setState((prev) => ({ ...INITIAL_STATE, speakerMuted: prev.speakerMuted, status: "connecting" }));
      try {
        const payload = await getLiveTranslateToken({ data: language }) as { token: string; model: string };
        if (cancelled) return;

        const client = new LiveTranslateClient({
          onStatus: (status) => {
            if (cancelled) return;
            if (status === "live") {
              setState((current) => ({ ...current, status: "listening", error: null }));
            } else if (status === "connecting") {
              setState((current) => ({ ...current, status: "connecting" }));
            } else if (status === "idle") {
              setState((current) => ({ ...current, status: "idle" }));
            }
          },
          onError: (message) => {
            if (cancelled) return;
            setState((current) => ({
              ...current,
              status: "error",
              error: message || "Translation connection failed.",
            }));
          },
          onInputLevel: (level) => {
            if (cancelled) return;
            setState((current) => ({ ...current, inputLevel: level }));
          },
          onTranscripts: (lines) => {
            if (cancelled) return;
            setTranscripts(lines);
            const sourceText = lastLineText(lines, "source");
            const translatedText = lastLineText(lines, "translation");
            setState((current) => ({
              ...current,
              sourceText: sourceText || current.sourceText,
              translatedText: translatedText || current.translatedText,
            }));
            if (translatedText) markPlaying();
          },
        });

        clientRef.current = client;
        client.setSpeakerMuted(speakerMuted);

        if (source === "microphone") {
          // Translate user's microphone speech
          client.setMicMuted(false);
          await client.start(
            {
              mode: "token",
              token: payload.token,
              model: payload.model,
              targetLanguage: language,
            },
            { useMicrophone: true, customStream: stream ?? null },
          );
        } else if (source === "screen") {
          // Translate screen / presentation audio
          client.setMicMuted(true);
          await client.start(
            {
              mode: "token",
              token: payload.token,
              model: payload.model,
              targetLanguage: language,
            },
            { displayStream: stream ?? null, useMicrophone: false },
          );
        } else {
          // Meeting / participant audio mode
          client.setMicMuted(true);
          await client.start(
            {
              mode: "token",
              token: payload.token,
              model: payload.model,
              targetLanguage: language,
            },
            { displayStream: stream ?? null, customStream: stream ?? null, useMicrophone: !stream },
          );
        }
      } catch (error) {
        if (cancelled) return;
        clientRef.current = null;
        setState((prev) => ({
          ...INITIAL_STATE,
          speakerMuted: prev.speakerMuted,
          status: "error",
          error: error instanceof Error ? error.message : "Translation could not start.",
        }));
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (playingTimer.current !== null) {
        window.clearTimeout(playingTimer.current);
        playingTimer.current = null;
      }
      const client = clientRef.current;
      clientRef.current = null;
      void client?.stop("idle");
    };
  }, [attempt, enabled, source, speakerMuted, stream, targetLanguageCode]);

  return {
    state,
    transcripts,
    restart,
    setSpeakerMuted,
    clearHistory,
  };
}
