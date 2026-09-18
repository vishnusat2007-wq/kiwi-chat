#!/usr/bin/env node

const VISHNU = process.env.BOT_TOKEN_VISHNU || "kiwi_vishnu_k9m2XqP4wR7nT1bH8sL3";
const FRIEND = process.env.BOT_TOKEN_FRIEND || "kiwi_friend_p5Yc8Nm2qK4wJ9tR6vA1";

console.log(`
  🥝  Kiwi Chat bot tokens
  ─────────────────────────────────────────────
  vishnu   ${VISHNU}
  friend   ${FRIEND}

  Header:  Authorization: Bearer <token>
`);
