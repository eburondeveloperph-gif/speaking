import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI, MediaResolution, Modality } from "@google/genai";
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translation-languages";
import { LiveTranslateClient, type TranscriptLine, type TranslateStatus } from "@/lib/translate/live-translate-client";

const MODEL = "gemini-3.5-live-translate-preview";

// 1. Server-side token provisioner
export const getLiveTranslateToken = createServerFn({ method: "POST" })
  .validator((targetLanguageCode: string) => {
    if (!TRANSLATION_LANGUAGE_CODES.has(targetLanguageCode)) {
      throw new Error("Unsupported target language: " + targetLanguageCode);
    }
    return targetLanguageCode;
  })
  .handler(async ({ data: targetLanguageCode }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Live translation is not configured yet. Missing GEMINI_API_KEY.");
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: "v1alpha" },
      });
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(now + 12 * 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model: MODEL,
            config: {
              responseModalities: [Modality.AUDIO],
              mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
              contextWindowCompression: {
                triggerTokens: "0",
                slidingWindow: { targetTokens: "0" },
              },
              translationConfig: {
                targetLanguageCode,
                echoTargetLanguage: true,
              },
            },
          },
        },
      });

      if (!token.name) {
        throw new Error("Translation could not start. Token generation returned empty name.");
      }

      return { token: token.name, model: MODEL };
    } catch (error) {
      console.error("Gemini Live server function error:", error);
      throw new Error(error instanceof Error ? error.message : "Translation could not start. Please try again.");
    }
  });

// 2. Client-side self-contained translation session manager
export class GeminiLiveService {
  private client: LiveTranslateClient | null = null;
  private onStatusChange: (status: TranslateStatus) => void;
  private onErrorCallback: (error: string) => void;
  private onInputLevelCallback: (level: number) => void;
  private onTranscriptsCallback: (lines: TranscriptLine[]) => void;
  private isConnecting = false;

  constructor(callbacks: {
    onStatus: (status: TranslateStatus) => void;
    onError: (error: string) => void;
    onInputLevel: (level: number) => void;
    onTranscripts: (lines: TranscriptLine[]) => void;
  }) {
    this.onStatusChange = callbacks.onStatus;
    this.onErrorCallback = callbacks.onError;
    this.onInputLevelCallback = callbacks.onInputLevel;
    this.onTranscriptsCallback = callbacks.onTranscripts;
  }

  /**
   * Starts a translation session by fetching the ephemeral token and establishing the WebSocket.
   */
  async startSession(
    targetLanguageCode: string,
    options: {
      stream?: MediaStream | null;
      source?: "meeting" | "microphone" | "screen";
      speakerMuted?: boolean;
    } = {}
  ) {
    if (this.isConnecting) return;
    this.isConnecting = true;
    this.onStatusChange("connecting");

    try {
      // Step 1: Fetch live translation token from secure server function
      const payload = await getLiveTranslateToken({ data: targetLanguageCode }) as { token: string; model: string };

      // Step 2: Initialize translation client
      this.client = new LiveTranslateClient({
        onStatus: (status) => {
          this.onStatusChange(status);
        },
        onError: (err) => {
          this.onErrorCallback(err);
        },
        onInputLevel: (level) => {
          this.onInputLevelCallback(level);
        },
        onTranscripts: (lines) => {
          this.onTranscriptsCallback(lines);
        },
      });

      // Step 3: Handle audio hardware settings
      const source = options.source ?? "meeting";
      const isMic = source === "microphone";
      const isScreen = source === "screen";

      this.client.setSpeakerMuted(options.speakerMuted ?? false);
      this.client.setMicMuted(!isMic);

      // Step 4: Establish secure live session
      await this.client.start(
        {
          mode: "token",
          token: payload.token,
          model: payload.model,
          targetLanguage: targetLanguageCode,
        },
        {
          customStream: options.stream ?? null,
          displayStream: isScreen ? options.stream ?? null : null,
          useMicrophone: isMic || !options.stream,
        }
      );
    } catch (err) {
      console.error("GeminiLiveService failed to start:", err);
      const message = err instanceof Error ? err.message : "Live translation could not start.";
      this.onErrorCallback(message);
      this.onStatusChange("error");
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Stops the active session and releases audio/socket resources safely.
   */
  async stopSession() {
    this.isConnecting = false;
    if (this.client) {
      await this.client.stop("idle");
      this.client = null;
    }
    this.onStatusChange("idle");
  }

  /**
   * Dynamically toggles microphone state.
   */
  setMicMuted(muted: boolean) {
    if (this.client) {
      this.client.setMicMuted(muted);
    }
  }

  /**
   * Dynamically toggles speaker playback state.
   */
  setSpeakerMuted(muted: boolean) {
    if (this.client) {
      this.client.setSpeakerMuted(muted);
    }
  }
}
