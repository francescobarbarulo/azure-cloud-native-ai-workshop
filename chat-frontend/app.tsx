import { useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { LoaderCircle, SendHorizonal, SparkleIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";

enum MessageType {
  USER,
  SYSTEM,
}

type Message = {
  type: MessageType;
  text: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setMessages((msgs) => [...msgs, { type: MessageType.USER, text: input }]);
    // Scroll after state updates
    setTimeout(() => {
      chatAreaRef.current?.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 0);

    let response = "";
    const res = await fetch(`${import.meta.env.VITE_CHAT_BACKEND}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input }),
    });

    if (res.status != 200 || !res.body) {
      setMessages((msgs) => [
        ...msgs,
        {
          type: MessageType.SYSTEM,
          text: "Something went wrong. Please try later.",
        },
      ]);
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          response += chunk;
          setMessages((msgs) => {
            const last = msgs[msgs.length - 1];
            if (last && last.type === MessageType.SYSTEM) {
              return [
                ...msgs.slice(0, -1),
                { type: MessageType.SYSTEM, text: response },
              ];
            }
            return [...msgs, { type: MessageType.SYSTEM, text: response }];
          });
          // Scroll smoothly to bottom as response streams
          setTimeout(() => {
            chatAreaRef.current?.scrollTo({
              top: chatAreaRef.current.scrollHeight,
              behavior: "smooth",
            });
          }, 0);
        }
      }
    }

    setLoading(false);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex justify-center py-4">
        <h3 className="text-xl font-semibold">Computer Gross AI Assistant</h3>
      </div>
      <div ref={chatAreaRef} className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="flex h-full">
            <div className="self-center mx-auto text-center w-1/2">
              <h1 className="bg-linear-to-r from-blue-600 from-30% to-70% to-pink-500 bg-clip-text text-6xl font-extrabold text-transparent mb-2">
                Ciao!
              </h1>
              <p className="text-neutral-500">
                Hai intenzione di iniziare un persorso di formazione su
                tecnologie Microsoft?<br></br> Sono qui per aiutarti.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-1/2 mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${
                  msg.type === MessageType.USER
                    ? "self-end bg-slate-200 px-4 py-2 rounded-xl rounded-tr-sm max-w-2/3"
                    : "self-start max-w-5/6"
                }`}
              >
                <div className="flex space-x-2 items-start">
                  {msg.type === MessageType.SYSTEM && (
                    <SparkleIcon className="w-4 shrink-0 text-blue-500 fill-blue-500" />
                  )}
                  <div className="whitespace-pre-wrap">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 w-1/2 mx-auto">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Chiedi all'assistente virtuale di Computer Gross"
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? (
            <LoaderCircle className="w-4 animate-spin" />
          ) : (
            <SendHorizonal className="w-4" />
          )}
        </Button>
      </div>
      <div className="flex justify-center items-center gap-2 py-4 w-1/2 mx-auto">
        <img
          src="/computer-gross-logo.svg"
          alt="Computer Gross"
          className="h-4"
        />
        <img src="/microsoft-logo.svg" alt="Microsoft" className="h-4" />
      </div>
    </div>
  );
}
