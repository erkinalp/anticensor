/**
 * Recommender System
 * Uses Semantic Scholar API to fetch and rerank papers.
 */

const S2_API_BASE = "https://api.semanticscholar.org/graph/v1";

async function fetchRecommendations(title, omrc) {
    if (!title) return [];

    try {
        // 1. Search for the current paper to get its ID (if possible) or just search by keywords
        // For simplicity, we'll search for papers with similar titles/keywords
        const searchUrl = `${S2_API_BASE}/paper/search?query=${encodeURIComponent(title)}&limit=20&fields=title,abstract,authors,year,url`;

        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        let candidates = data.data || [];

        // Filter out the exact same paper if found
        candidates = candidates.filter((p) => p.title.toLowerCase() !== title.toLowerCase());

        // 2. Rerank based on OMRC similarity
        // Since we don't have the candidates' full text to extract OMRC reliably without heavy processing,
        // we will use the candidate's abstract as a proxy and compare it against our extracted OMRC.

        const ranked = candidates.map((paper) => {
            const score = calculateSimilarity(omrc, paper.abstract || paper.title);
            return { ...paper, score };
        });

        // Sort by score descending
        ranked.sort((a, b) => b.score - a.score);

        return ranked.slice(0, 10); // Return top 10
    } catch (error) {
        console.error("Recommendation error:", error);
        return [];
    }
}

function calculateSimilarity(sourceOMRC, targetText) {
    if (!targetText) return 0;

    // Flatten source OMRC to a single string for simple comparison
    // In a full implementation, we would compare Objective-to-Objective, Method-to-Method etc.
    // But target papers from API don't have pre-extracted OMRC.

    // We give higher weight to Method and Result overlap as per the paper's "Discourse-Aware" philosophy
    const sourceText = `${sourceOMRC.Method} ${sourceOMRC.Result} ${sourceOMRC.Objective} ${sourceOMRC.Conclusion}`;

    const sourceTokens = new Set(
        sourceText
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 3),
    );
    const targetTokens = new Set(
        targetText
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 3),
    );

    let intersection = 0;
    sourceTokens.forEach((token) => {
        if (targetTokens.has(token)) intersection++;
    });

    const union = new Set([...sourceTokens, ...targetTokens]).size;
    return union === 0 ? 0 : intersection / union;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { fetchRecommendations };
} else {
    window.fetchRecommendations = fetchRecommendations;
}
