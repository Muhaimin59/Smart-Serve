/* Real-time booking chat: socket-driven, persisted server-side. */
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ImagePlus, Send } from "lucide-react";
import { getSocket, useSocketEvent } from "../lib/socket";
import { getToken, uploadImage, ApiError } from "../lib/api";
import { useAuth, useLang, useToast } from "../lib/store";
import { fmtTime } from "../lib/format";
import { Button, EmptyState, Spinner } from "./ui";

type Msg = {
  id: string;
  bookingId?: string;
  senderId: string;
  text?: string | null;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  mine?: boolean;
};

export function ChatPanel({ bookingId, openStatus }: { bookingId: string; openStatus: string }) {
  const { user } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chatOpen = ["accepted", "confirmed", "on_the_way", "arrived", "in_progress", "completed", "payment_pending", "paid", "disputed"].includes(openStatus);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await (await fetch(`/api/bookings/${bookingId}/messages`, { headers: { Authorization: `Bearer ${getToken()}` } })).json();
        if (!cancelled) setMessages((res.messages ?? []).map((m: Msg) => ({ ...m, mine: m.senderId === user?.id })));
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, user?.id]);

  useSocketEvent("chat:message", ({ message }: { message: Msg }) => {
    if (message.bookingId !== bookingId) return;
    setMessages((list) => (list === null ? list : list.some((m) => m.id === message.id) ? list : [...list, { ...message, mine: message.senderId === user?.id }]));
  });
  useSocketEvent("chat:read", ({ by }: { bookingId: string; by: string }) => {
    setMessages((list) => (list === null ? list : list.map((m) => (!m.mine && !m.readAt && by !== user?.id ? { ...m, readAt: new Date().toISOString() } : m))));
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!chatOpen || messages === null || messages.length === 0) return;
    const s = getSocket();
    if (s) s.emit("chat:read", { bookingId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, chatOpen]);

  async function send() {
    const body = text.trim();
    if (!body || !getSocket()) return;
    setSending(true);
    const res = await new Promise<any>((resolve) => {
      getSocket()!.emit("chat:send", { bookingId, text: body }, (r: any) => resolve(r));
    });
    setText("");
    setSending(false);
    if (!res?.ok) toast("error", res?.error ?? "Could not send the message.");
  }

  async function attachImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !getSocket()) return;
    try {
      const url = await uploadImage(file, "chat");
      const res = await new Promise<any>((resolve) => {
        getSocket()!.emit("chat:send", { bookingId, imageUrl: url }, (r: any) => resolve(r));
      });
      if (!res?.ok) toast("error", res?.error ?? "Could not send the image.");
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Upload failed.");
    }
  }

  if (!chatOpen) {
    return <EmptyState icon="💬" title={t("chat")} subtitle="Chat opens as soon as a provider accepts this booking." />;
  }
  if (messages === null) return <Spinner label={t("loading")} />;

  return (
    <div className="flex flex-col" style={{ height: 420 }}>
      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto rounded-xl p-3 flex flex-col gap-2" style={{ background: "var(--surface-2)" }}>
        {messages.length === 0 && <p className="text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>Say hello to your provider 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
              style={m.mine ? { background: "var(--primary)", color: "var(--primary-text)", borderBottomRightRadius: 6 } : { background: "var(--surface-solid)", border: "1px solid var(--border)", borderBottomLeftRadius: 6 }}
            >
              {m.imageUrl && <img src={m.imageUrl} alt="shared" className="rounded-lg max-h-48 mb-1" />}
              {m.text && <p className="m-0 whitespace-pre-wrap break-words">{m.text}</p>}
              <div className="flex items-center gap-1 justify-end mt-0.5" style={{ opacity: 0.7, fontSize: 11 }}>
                {fmtTime(m.createdAt)}
                {m.mine && (m.readAt ? <CheckCheck size={13} /> : <Check size={13} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={attachImage} />
        <Button variant="ghost" size="sm" className="!min-h-11 !px-3" onClick={() => fileRef.current?.click()} aria-label="Send image">
          <ImagePlus size={18} />
        </Button>
        <input
          className="input !min-h-11"
          placeholder={t("typeMessage")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          maxLength={4000}
        />
        <Button size="sm" className="!min-h-11 !px-4" onClick={send} loading={sending} aria-label={t("send")}>
          <Send size={17} />
        </Button>
      </div>
    </div>
  );
}
