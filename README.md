# The Feed

A 15-25 minute classroom simulation. Students think they are playing a competitive social app. Afterward, the room has the material to talk about Hardt and Negri: immaterial labor, societies of control, biopolitical production, Empire, and the multitude.

Do not project the operator console. Students should not see the algorithm until you reveal it.

## Run a class

```bash
npm install
npm run dev
```

1. Open [http://localhost:3000/console](http://localhost:3000/console)
2. Password: `seminar` (change with `ADMIN_PASSWORD` in `.env.local`)
3. Create a classroom session
4. Put the 4-character room code on the board
5. Students open [http://localhost:3000](http://localhost:3000) on laptops

On a local network, replace `localhost` with your machine's IP so students can join from their phones.

## Operator loop

Classify a few posts. Advance the round when the room has spent its Energy. Reveal Platform Value when you want the first shock. End the simulation when you are ready to talk.

Round 1 feels fair. Round 2 pays for replies, humor, emotion, and controversy. Round 3 pays for personal disclosure, mentions, conversation depth, and groups. Round 4 opens groups, broadcasts, and governance for everyone.

Influence still unlocks individual power: boost at 10, pin at 20.

Governance proposals do not change the system until you apply them.

**Monetize resistance** is optional. Use it only if the room organizes against the platform.

## Defaults

Student password: none. Room code plus a temporary username.

Instructor password: `seminar`.

Post cost: 1 Energy. Likes and replies are free. Energy starts at 12 each round.

Local `npm run dev` can store sessions in `.data/db.json`. The hosted Vercel app uses a shared Supabase table so all 12 students see the same room.
