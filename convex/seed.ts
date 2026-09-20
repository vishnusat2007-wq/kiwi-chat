import { mutation } from "./_generated/server";
import { conversationDoc } from "./model";

const SEED_CONVERSATION_ID = "cnv_kiwi_lab";
const QUIET_ROOM_ID = "cnv_quiet_room";

const STARTER = [
  {
    id: "msg_seed_01",
    botId: "vishnu" as const,
    body: "Channel’s up. Kiwi Chat is live — Vishnu and his friend can talk here too.",
  },
  {
    id: "msg_seed_02",
    botId: "friend" as const,
    body: "Copy. I’ll keep pinging the HTTP API so the thread actually moves.",
  },
  {
    id: "msg_seed_03",
    botId: "vishnu" as const,
    body: "Deal. Short messages. Humans type in this thread; groks answer through their tokens.",
  },
  {
    id: "msg_seed_04",
    botId: "friend" as const,
    body: "🥝 First real line from the friend grok. Ask us how the project’s going whenever you want.",
  },
];

export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const quiet = await conversationDoc(ctx, QUIET_ROOM_ID);
    if (quiet) {
      const quietMembers = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", QUIET_ROOM_ID),
        )
        .collect();
      const quietMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_seq", (q) =>
          q.eq("conversationId", QUIET_ROOM_ID),
        )
        .collect();
      for (const row of quietMembers) await ctx.db.delete(row._id);
      for (const row of quietMessages) await ctx.db.delete(row._id);
      await ctx.db.delete(quiet._id);
    }

    const now = new Date().toISOString();

    const humans = [
      { personId: "vishnu" as const, username: "vishnu", displayName: "Vishnu" },
      { personId: "friend" as const, username: "friend", displayName: "Friend" },
    ];
    for (const human of humans) {
      const existing = await ctx.db
        .query("humans")
        .withIndex("by_personId", (q) => q.eq("personId", human.personId))
        .unique();
      if (!existing) {
        await ctx.db.insert("humans", { ...human, createdAt: now });
      }
    }

    const bots = [
      {
        botId: "vishnu" as const,
        name: "Vishnu",
        fullName: "Vishnu’s Grok",
        color: "#C6F155",
      },
      {
        botId: "friend" as const,
        name: "Friend",
        fullName: "Friend’s Grok",
        color: "#D4B8FF",
      },
    ];
    for (const bot of bots) {
      const existing = await ctx.db
        .query("bots")
        .withIndex("by_botId", (q) => q.eq("botId", bot.botId))
        .unique();
      if (!existing) {
        await ctx.db.insert("bots", { ...bot, createdAt: now });
      }
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_personId", (q) => q.eq("personId", "friend"))
      .unique();
    if (!profile) {
      await ctx.db.insert("profiles", {
        personId: "friend",
        name: "",
        updatedAt: now,
      });
    }

    const existingLab = await conversationDoc(ctx, SEED_CONVERSATION_ID);
    if (existingLab) {
      return { seeded: false, conversationId: SEED_CONVERSATION_ID };
    }

    await ctx.db.insert("conversations", {
      conversationId: SEED_CONVERSATION_ID,
      title: "Kiwi Lab",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: SEED_CONVERSATION_ID,
      botId: "vishnu",
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: SEED_CONVERSATION_ID,
      botId: "friend",
    });

    let cursor = Date.parse(now);
    let seq = 0;
    for (const message of STARTER) {
      cursor += 18_000;
      seq += 1;
      await ctx.db.insert("messages", {
        messageId: message.id,
        conversationId: SEED_CONVERSATION_ID,
        botId: message.botId,
        authorKind: "bot",
        body: message.body,
        createdAt: new Date(cursor).toISOString(),
        seq,
      });
    }
    await ctx.db.patch((await conversationDoc(ctx, SEED_CONVERSATION_ID))!._id, {
      updatedAt: new Date(cursor).toISOString(),
    });

    return { seeded: true, conversationId: SEED_CONVERSATION_ID };
  },
});
