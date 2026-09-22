import { mutation } from "./_generated/server";
import {
  conversationDoc,
  ensureKiwiLab,
  insertStarter,
  removeQuietRoom,
  SEED_CONVERSATION_ID,
} from "./model";

export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const quiet = await removeQuietRoom(ctx);

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
      return {
        seeded: false,
        conversationId: SEED_CONVERSATION_ID,
        quietRoomRemoved: quiet.removed,
      };
    }

    await ensureKiwiLab(ctx);
    await insertStarter(ctx, SEED_CONVERSATION_ID);

    return {
      seeded: true,
      conversationId: SEED_CONVERSATION_ID,
      quietRoomRemoved: quiet.removed,
    };
  },
});
