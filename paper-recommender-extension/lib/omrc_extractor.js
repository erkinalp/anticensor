/**
 * Heuristic-based OMRC Extractor
 * Extracts Objective, Method, Result, Conclusion from abstract text.
 */

const OMRC_KEYWORDS = {
    OBJECTIVE: ["objective", "aim", "goal", "purpose", "propose", "introduce", "present", "address", "problem"],
    METHOD: ["method", "approach", "framework", "algorithm", "model", "technique", "utilize", "use", "based on", "via"],
    RESULT: ["result", "finding", "show", "demonstrate", "achieve", "perform", "outperform", "improvement", "accuracy"],
    CONCLUSION: ["conclusion", "conclude", "summary", "future", "implication", "suggest", "overall"],
};

function extractOMRC(abstract) {
    if (!abstract) return null;

    const sentences = abstract.split(/[.!?]\s+/);
    const omrc = {
        OBJECTIVE: [],
        METHOD: [],
        RESULT: [],
        CONCLUSION: [],
    };

    // Simple sentence classification based on keyword density
    // This is a naive approximation of the paper's deep learning model

    sentences.forEach((sentence) => {
        const lowerSent = sentence.toLowerCase();
        let maxScore = 0;
        let bestCategory = null;

        for (const [category, keywords] of Object.entries(OMRC_KEYWORDS)) {
            let score = 0;
            keywords.forEach((kw) => {
                if (lowerSent.includes(kw)) score++;
            });

            // Weighting: First sentence often Objective, last often Conclusion
            if (category === "OBJECTIVE" && sentences.indexOf(sentence) === 0) score += 2;
            if (category === "CONCLUSION" && sentences.indexOf(sentence) === sentences.length - 1) score += 2;

            if (score > maxScore) {
                maxScore = score;
                bestCategory = category;
            }
        }

        if (bestCategory) {
            omrc[bestCategory].push(sentence);
        } else {
            // Default fallback logic
            const pos = sentences.indexOf(sentence) / sentences.length;
            if (pos < 0.25) omrc.OBJECTIVE.push(sentence);
            else if (pos < 0.5) omrc.METHOD.push(sentence);
            else if (pos < 0.75) omrc.RESULT.push(sentence);
            else omrc.CONCLUSION.push(sentence);
        }
    });

    // Join arrays back to strings
    return {
        Objective: omrc.OBJECTIVE.join(". ") + ".",
        Method: omrc.METHOD.join(". ") + ".",
        Result: omrc.RESULT.join(". ") + ".",
        Conclusion: omrc.CONCLUSION.join(". ") + ".",
    };
}

// Export for use in other modules (ESM or CommonJS depending on environment)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { extractOMRC };
} else {
    window.extractOMRC = extractOMRC;
}
