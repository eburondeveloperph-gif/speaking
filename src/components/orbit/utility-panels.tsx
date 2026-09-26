import { useEffect, useMemo, useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  Copy,
  Heart,
  Languages,
  Mic,
  Monitor,
  Play,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeeting } from "@/lib/meeting-store";
import {
  useLiveTranslation,
  type TranslationSource,
} from "@/lib/live-translation";
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from "@/lib/translation-languages";

const DONATION_AMOUNTS = [10, 25, 50, 100];

const POPULAR_LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "zh-Hans",
  "ja",
  "ko",
  "hi",
  "ar",
  "pt-BR",
  "it",
  "ru",
];

export function TranslatorAudioVisualizer({
  running,
  playing,
  level = 0,
}: {
  running: boolean;
  playing: boolean;
  level?: number;
}) {
  const isAudioActive = running && (playing || level > 0.03);

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-subtle/80 border border-line"
      title={
        !running
          ? "Translator inactive"
          : playing
            ? "Playing translated voice audio"
            : "Listening for speech"
      }
    >
      <div className="flex items-end gap-[3px] h-3.5 w-5">
        {[0, 1, 2, 3].map((barIndex) => {
          let heightPercent = 25;
          if (running) {
            if (playing) {
              // Bouncing sound wave when translation speech is outputting
              const stagger = (barIndex % 2 === 0 ? 80 : 50) + (barIndex * 15);
              heightPercent = Math.min(100, Math.max(30, stagger));
            } else if (level > 0.03) {
              const boost = Math.min(100, Math.max(25, level * 120 + barIndex * 12));
              heightPercent = boost;
            } else {
              heightPercent = 30 + (barIndex % 2) * 15;
            }
          }

          return (
            <span
              key={barIndex}
              className={`block w-[3px] rounded-full transition-all duration-100 ${
                !running
                  ? "bg-faint/40"
                  : playing
                    ? "bg-accent animate-pulse"
                    : isAudioActive
                      ? "bg-live"
                      : "bg-muted"
              }`}
              style={{
                height: `${heightPercent}%`,
                animationDelay: playing ? `${barIndex * 120}ms` : undefined,
              }}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-faint ml-0.5">
        {!running ? "Off" : playing ? "Voice" : "Live"}
      </span>
    </div>
  );
}

export function TranslatorPanel({
  active = true,
  incomingStream = null,
}: {
  active?: boolean;
  incomingStream?: MediaStream | null;
}) {
  const [isRunning, setIsRunning] = useState(true);
  const [targetLanguageCode, setTargetLanguageCode] = useState("es");
  const [source, setSource] = useState<TranslationSource>("meeting");
  const [speakerMuted, setSpeakerMutedLocal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const setStoreRunning = useMeeting((state) => state.setTranslatorRunning);
  const setStoreLevel = useMeeting((state) => state.setTranslatorLevel);
  const setStorePlaying = useMeeting((state) => state.setTranslatorPlaying);

  const isEnabled = active && isRunning;

  const { state, transcripts, restart, setSpeakerMuted, clearHistory } = useLiveTranslation({
    stream: incomingStream,
    enabled: isEnabled,
    targetLanguageCode,
    source,
    speakerMuted,
  });

  const isPlayingAudio = state.status === "playing";

  useEffect(() => {
    setStoreRunning(isEnabled);
    setStorePlaying(isPlayingAudio);
    setStoreLevel(state.inputLevel);
    return () => {
      setStoreRunning(false);
      setStorePlaying(false);
      setStoreLevel(0);
    };
  }, [isEnabled, isPlayingAudio, state.inputLevel, setStoreRunning, setStorePlaying, setStoreLevel]);

  const selectedLanguage = useMemo(
    () =>
      TRANSLATION_LANGUAGES.find((item) => item.code === targetLanguageCode) ??
      TRANSLATION_LANGUAGES[0],
    [targetLanguageCode],
  );

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return TRANSLATION_LANGUAGES;
    return TRANSLATION_LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const popularLanguages = useMemo(
    () =>
      POPULAR_LANGUAGE_CODES.map((code) =>
        TRANSLATION_LANGUAGES.find((lang) => lang.code === code),
      ).filter((lang): lang is TranslationLanguage => Boolean(lang)),
    [],
  );

  function handleLanguageSelect(code: string) {
    setTargetLanguageCode(code);
    setPickerOpen(false);
    setSearchQuery("");
  }

  function toggleVoice() {
    const next = !speakerMuted;
    setSpeakerMutedLocal(next);
    setSpeakerMuted(next);
  }

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-elevated text-fg">
      {/* Target Language Selection Header */}
      <div className="border-b border-line p-4">
        {/* Main Start/Stop Action Button */}
        <div className="mb-4">
          {isRunning ? (
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="w-full flex items-center justify-center gap-2 font-semibold shadow-md"
              onClick={() => setIsRunning(false)}
            >
              <Square className="size-4 fill-current" />
              <span>Stop Translator</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2 font-semibold shadow-md"
              onClick={() => setIsRunning(true)}
            >
              <Play className="size-4 fill-current" />
              <span>Start Translator</span>
            </Button>
          )}
        </div>

        <label
          className="text-xs font-semibold uppercase tracking-wider text-muted"
          htmlFor="language-search-trigger"
        >
          Translate speech into ({TRANSLATION_LANGUAGES.length} languages activated)
        </label>

        {/* Popover Language Selector with Instant Search */}
        <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
          <Popover.Trigger asChild>
            <button
              id="language-search-trigger"
              type="button"
              className="mt-2 flex h-11 w-full items-center justify-between rounded-md border border-strong bg-bg px-3 text-sm font-medium text-fg outline-none transition-colors hover:border-accent/40 focus:border-accent"
            >
              <span className="flex items-center gap-2 truncate">
                <Languages className="size-4 text-muted" />
                <span className="truncate">{selectedLanguage?.name}</span>
                <span className="rounded bg-subtle px-1.5 py-0.5 text-xs font-mono text-faint">
                  {selectedLanguage?.code}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={6}
              className="z-50 w-80 rounded-xl border border-line bg-elevated p-2 shadow-panel backdrop-blur-md sm:w-96"
            >
              {/* Search box inside popover */}
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${TRANSLATION_LANGUAGES.length} languages…`}
                  className="h-10 w-full rounded-md border border-strong bg-bg pl-9 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
                  autoFocus
                />
              </div>

              {/* Quick Picks */}
              {!searchQuery && (
                <div className="mb-2 border-b border-line/60 pb-2">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-faint">
                    Popular
                  </p>
                  <div className="flex flex-wrap gap-1 px-1">
                    {popularLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleLanguageSelect(lang.code)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          targetLanguageCode === lang.code
                            ? "bg-accent text-ink"
                            : "bg-subtle text-fg hover:bg-line"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtered list */}
              <div className="scroll-thin max-h-60 overflow-y-auto pr-1">
                {filteredLanguages.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted">
                    No languages match &ldquo;{searchQuery}&rdquo;
                  </p>
                ) : (
                  filteredLanguages.map((lang) => {
                    const isSelected = lang.code === targetLanguageCode;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleLanguageSelect(lang.code)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-accent/15 text-fg font-medium"
                            : "text-muted hover:bg-subtle hover:text-fg"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="truncate">{lang.name}</span>
                          <span className="font-mono text-xs text-faint">({lang.code})</span>
                        </span>
                        {isSelected && <Check className="size-4 shrink-0 text-accent" />}
                      </button>
                    );
                  })
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Audio Input Source Selector */}
        <div className="mt-3 flex items-center justify-between gap-1 rounded-lg border border-line bg-bg p-1 text-xs font-medium text-muted">
          <button
            type="button"
            onClick={() => setSource("meeting")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
              source === "meeting" ? "bg-elevated text-fg shadow-sm" : "hover:text-fg"
            }`}
          >
            <Users className="size-3.5" />
            <span>Meeting</span>
          </button>
          <button
            type="button"
            onClick={() => setSource("microphone")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
              source === "microphone" ? "bg-elevated text-fg shadow-sm" : "hover:text-fg"
            }`}
          >
            <Mic className="size-3.5" />
            <span>My Mic</span>
          </button>
          <button
            type="button"
            onClick={() => setSource("screen")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
              source === "screen" ? "bg-elevated text-fg shadow-sm" : "hover:text-fg"
            }`}
          >
            <Monitor className="size-3.5" />
            <span>Screen</span>
          </button>
        </div>
      </div>

      {/* Live Status & Audio Controls Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${
              !isRunning
                ? "bg-faint"
                : state.status === "error"
                  ? "bg-danger"
                  : state.status === "connecting"
                    ? "animate-pulse bg-muted"
                    : state.status === "playing"
                      ? "animate-pulse bg-accent"
                      : "bg-live"
            }`}
          />
          <p className="truncate text-xs font-medium text-muted">
            {!isRunning
              ? "Translator is stopped"
              : state.status === "connecting"
                ? "Connecting to Gemini Live…"
                : state.status === "playing"
                  ? `Speaking voice translation in ${selectedLanguage.name}…`
                  : state.status === "error"
                    ? "Connection error"
                    : `Listening • Output in ${selectedLanguage.name}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Header synced visualizer */}
          <TranslatorAudioVisualizer
            running={isRunning}
            playing={isPlayingAudio}
            level={state.inputLevel}
          />

          {/* Voice mute toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted hover:text-fg"
            aria-label={
              speakerMuted
                ? "Unmute spoken voice translation"
                : "Mute spoken voice translation"
            }
            title={speakerMuted ? "Unmute voice audio" : "Mute voice audio"}
            onClick={toggleVoice}
          >
            {speakerMuted ? (
              <VolumeX className="size-3.5 text-danger" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
          </Button>

          {/* Reconnect button */}
          {isRunning && (
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted hover:text-fg"
              aria-label="Restart translation"
              title="Reconnect translator"
              onClick={restart}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Conversation & Transcripts Feed */}
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {/* Active Realtime Translation Card */}
        <div className="rounded-xl border border-line bg-subtle p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              Live Speech
            </span>
            {state.sourceText && (
              <button
                type="button"
                onClick={() => copyText(state.sourceText, "live-source")}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-fg"
              >
                <Copy className="size-3" />
                {copiedId === "live-source" ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {state.sourceText || (
              <span className="italic text-faint">
                {!isRunning
                  ? "Press 'Start Translator' to begin translating."
                  : source === "microphone"
                    ? "Speak into your microphone…"
                    : "Listening for participant speech…"}
              </span>
            )}
          </p>

          <div className="mt-3.5 flex items-center justify-between gap-2 border-b border-line/60 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              {selectedLanguage.name} Translation
            </span>
            {state.translatedText && (
              <button
                type="button"
                onClick={() => copyText(state.translatedText, "live-target")}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-fg"
              >
                <Copy className="size-3" />
                {copiedId === "live-target" ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-fg">
            {state.translatedText || (
              <span className="italic text-faint">Live translation will appear here.</span>
            )}
          </p>
        </div>

        {/* Previous Transcripts Log */}
        {transcripts.length > 0 && (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-faint">
                Transcript History
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="flex items-center gap-1 text-xs text-muted hover:text-danger"
              >
                <Trash2 className="size-3" />
                Clear
              </button>
            </div>

            <div className="space-y-2">
              {transcripts.map((line) => (
                <div
                  key={line.id}
                  className={`rounded-lg border p-2.5 text-xs leading-normal ${
                    line.role === "translation"
                      ? "border-accent/20 bg-accent/5 text-fg font-medium"
                      : "border-line bg-bg text-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-faint mb-1">
                    <span className="font-semibold uppercase tracking-wider">
                      {line.role === "translation" ? selectedLanguage.name : "Original"}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(line.text, line.id)}
                      className="hover:text-fg"
                    >
                      {copiedId === line.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p>{line.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Card */}
        {state.error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger">
            <p className="font-medium">{state.error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full border-danger/30 text-fg"
              onClick={restart}
            >
              Reconnect Translator
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DonatePanel({ returnPath }: { returnPath: string }) {
  const [amount, setAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedAmount = customAmount ? Number(customAmount) : amount;

  async function donate(event: FormEvent) {
    event.preventDefault();
    if (!Number.isInteger(selectedAmount) || selectedAmount < 5 || selectedAmount > 500) {
      setError("Choose an amount from $5 to $500.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: selectedAmount, returnPath }),
      });
      const payload = (await response.json()) as {
        mode?: "demo" | "live";
        url?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Checkout could not be created.");
      if (payload.mode === "live" && payload.url) {
        window.location.assign(payload.url);
        return;
      }
      setMessage(`Demo donation of $${selectedAmount} prepared. No payment was taken.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not be created.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={donate} className="scroll-thin h-full overflow-y-auto p-4">
      <div className="rounded-md border border-line bg-subtle p-4">
        <Heart className="size-5 text-fg" />
        <h3 className="mt-3 text-base font-medium">Support Orbit</h3>
        <p className="mt-1 text-sm leading-normal text-muted">
          Help keep simple, private meetings open to everyone.
        </p>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Donation amount</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DONATION_AMOUNTS.map((value) => (
            <Button
              key={value}
              type="button"
              variant={!customAmount && amount === value ? "primary" : "secondary"}
              onClick={() => {
                setAmount(value);
                setCustomAmount("");
                setMessage(null);
              }}
            >
              ${value}
            </Button>
          ))}
        </div>
        <label className="mt-3 grid gap-2 text-sm font-medium" htmlFor="custom-donation">
          Custom amount
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              $
            </span>
            <input
              id="custom-donation"
              type="number"
              inputMode="numeric"
              min={5}
              max={500}
              value={customAmount}
              onChange={(event) => {
                setCustomAmount(event.target.value);
                setMessage(null);
              }}
              placeholder="25"
              className="h-12 w-full rounded-md border border-strong bg-bg pl-7 pr-3 text-base text-fg outline-none placeholder:text-faint"
            />
          </span>
        </label>
      </fieldset>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="mt-5 w-full"
        disabled={loading}
      >
        {loading
          ? "Opening checkout…"
          : `Donate $${Number.isFinite(selectedAmount) ? selectedAmount : 0}`}
      </Button>

      {message && (
        <p
          role="status"
          className="mt-3 rounded-md border border-line bg-subtle p-3 text-sm leading-normal text-muted"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-line bg-subtle p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </form>
  );
}
