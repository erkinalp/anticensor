importScripts("lib/omrc_extractor.js", "lib/recommender.js");

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyzeCurrentItem") {
        handleAnalysis(sendResponse);
        return true; // Keep message channel open for async response
    }
});

async function handleAnalysis(sendResponse) {
    try {
        // In a real Zotero environment, we would access the Zotero API here.
        // For this WebExtension prototype, we will mock the "current item" retrieval
        // or try to get it from the active tab if it's a known paper URL (like arXiv).

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        let paperData = { title: "", abstract: "" };

        if (activeTab && activeTab.url) {
            // Simple scraper for arXiv pages to demonstrate functionality
            if (activeTab.url.includes("arxiv.org/abs/")) {
                const result = await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: () => {
                        const title = document.querySelector("h1.title")?.innerText.replace("Title:", "").trim();
                        const abstract = document.querySelector("blockquote.abstract")?.innerText.replace("Abstract:", "").trim();
                        return { title, abstract };
                    },
                });
                if (result && result[0] && result[0].result) {
                    paperData = result[0].result;
                }
            } else {
                // Mock data if not on a supported page, just to show UI works
                paperData = {
                    title: "Discourse-Aware Scientific Paper Recommendation via QA-Style Summarization",
                    abstract:
                        "The rapid growth of open-access (OA) publications has intensified the challenge of identifying relevant scientific papers. We propose OMRC-MR, a hierarchical framework that integrates QA-style OMRC summarization.",
                };
            }
        }

        if (!paperData.abstract) {
            sendResponse({ error: "No abstract found on this page." });
            return;
        }

        // 1. Extract OMRC
        const omrc = extractOMRC(paperData.abstract);

        // 2. Fetch Recommendations
        const recommendations = await fetchRecommendations(paperData.title, omrc);

        sendResponse({ omrc, recommendations });
    } catch (error) {
        console.error(error);
        sendResponse({ error: error.message });
    }
}
