const { extractOMRC } = require("./lib/omrc_extractor.js");
const { fetchRecommendations } = require("./lib/recommender.js");

// Mock fetch for Node.js environment
global.fetch = async (url) => {
    console.log(`[MockFetch] Requesting: ${url}`);
    return {
        ok: true,
        json: async () => ({
            data: [
                {
                    title: "Paper A",
                    abstract: "We propose a new method for paper recommendation using deep learning.",
                    authors: [{ name: "Author 1" }],
                    year: 2024,
                    url: "http://example.com/a",
                },
                {
                    title: "Paper B",
                    abstract: "This study analyzes the impact of OMRC structure on citation counts.",
                    authors: [{ name: "Author 2" }],
                    year: 2023,
                    url: "http://example.com/b",
                },
                { title: "Paper C", abstract: "Unrelated work on quantum physics.", authors: [{ name: "Author 3" }], year: 2022, url: "http://example.com/c" },
            ],
        }),
    };
};

async function runTest() {
    console.log("=== Testing OMRC Extractor ===");
    const abstract = "The rapid growth of publications is a problem. We utilize OMRC-MR, a new framework. Our results show a 5% improvement. We conclude that this is useful.";
    const omrc = extractOMRC(abstract);
    console.log("Extracted OMRC:", JSON.stringify(omrc, null, 2));

    if (omrc.Objective.includes("problem") && omrc.Method.includes("framework") && omrc.Result.includes("improvement") && omrc.Conclusion.includes("useful")) {
        console.log("PASS: OMRC Extraction logic seems correct.");
    } else {
        console.error("FAIL: OMRC Extraction logic failed.");
    }

    console.log("\n=== Testing Recommender ===");
    const recommendations = await fetchRecommendations("Test Paper Title", omrc);
    console.log("Recommendations:", JSON.stringify(recommendations, null, 2));

    if (recommendations.length > 0 && recommendations[0].score >= 0) {
        console.log("PASS: Recommender returned results with scores.");
    } else {
        console.error("FAIL: Recommender failed to return valid results.");
    }
}

runTest();
