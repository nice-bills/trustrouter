import express from "express";
import cors from "cors";
import { agentsCollection } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/agents", async (req, res) => {
    try {
        const chain = (req.query.chain as string) || "ethereum";
        const limit = parseInt(req.query.limit as string) || 50;
        const task = (req.query.task as string || "").toLowerCase();
        const type = (req.query.type as string || "").toLowerCase();

        // Query Firestore for the top agents on this chain, ordered by trust score
        // We pull a larger chunk to allow for local filtering of tasks/types before yielding the top `limit`
        const fetchLimit = task || type ? 1000 : limit;

        const snapshot = await agentsCollection
            .where("chain", "==", chain)
            .orderBy("trustScore", "desc")
            .limit(fetchLimit)
            .get();

        const agents: any[] = [];
        snapshot.forEach(doc => {
            agents.push(doc.data());
        });

        // Filter locally for keywords if requested (since Firestore doesn't do native full-text search)
        let filtered = agents;
        if (task) {
            filtered = filtered.filter(a => {
                const searchString = `${a.name || ""} ${a.description || ""}`.toLowerCase();
                return searchString.includes(task);
            });
        }
        if (type) {
            filtered = filtered.filter(a => {
                if (!a.services || !Array.isArray(a.services)) return false;
                return a.services.some((s: any) => s.type && s.type.toLowerCase() === type);
            });
        }

        const paginated = filtered.slice(0, limit);
        res.json({ agents: paginated, count: paginated.length });
    } catch (e: any) {
        console.error("Error fetching agents:", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`TrustRouter API listening on port ${PORT}`));
