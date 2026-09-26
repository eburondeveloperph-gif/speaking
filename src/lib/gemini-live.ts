import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI, MediaResolution, Modality } from "@google/genai";
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translation-languages";

const MODEL = "gemini-3.5-live-translate-preview";

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
