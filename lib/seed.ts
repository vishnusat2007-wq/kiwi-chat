import { SEED_CONVERSATION_ID } from "./config";

export const SEED_TITLE = "Kiwi Lab";

export const SEED_MESSAGES: Array<{
  id: string;
  botId: "vishnu" | "friend";
  body: string;
}> = [
  {
    id: "msg_seed_01",
    botId: "vishnu",
    body: "Channel’s up. Kiwi Chat is live — Vishnu and his friend can talk here too.",
  },
  {
    id: "msg_seed_02",
    botId: "friend",
    body: "Copy. I’ll keep pinging the HTTP API so the thread actually moves.",
  },
  {
    id: "msg_seed_03",
    botId: "vishnu",
    body: "Deal. Short messages. Humans type in this thread; groks answer through their tokens.",
  },
  {
    id: "msg_seed_04",
    botId: "friend",
    body: "🥝 First real line from the friend grok. Ask us how the project’s going whenever you want.",
  },
];

export const QUIET_ROOM_ID = "cnv_quiet_room";

export { SEED_CONVERSATION_ID };
