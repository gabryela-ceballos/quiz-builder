// Auto-assigns weights: option A=1, B=2, C=3, D=4
export function getAutoWeights(options) {
    return options.map((_, i) => i + 1);
}

// Calculates total score and matched result
export function calculateResult(quiz, answers) {
    let total = 0;
    quiz.questions.forEach((q, qi) => {
        const answerIndex = answers[qi];
        if (answerIndex !== undefined) {
            const weights = getAutoWeights(q.options);
            total += weights[answerIndex] || 0;
        }
    });

    const results = quiz.results.sort((a, b) => a.minScore - b.minScore);
    for (const result of results) {
        if (total >= result.minScore && total <= result.maxScore) {
            return { result, score: total };
        }
    }
    // Fallback to last result
    return { result: results[results.length - 1], score: total };
}

// Recalculates score ranges based on question count
export function recalcScoreRanges(quiz) {
    const n = quiz.questions.length;
    const minPossible = n * 1;
    const maxPossible = n * 4;
    const range = maxPossible - minPossible;
    const count = quiz.results.length;

    return quiz.results.map((r, i) => ({
        ...r,
        minScore: i === 0 ? minPossible : Math.round(minPossible + (range / count) * i),
        maxScore: i === count - 1 ? maxPossible : Math.round(minPossible + (range / count) * (i + 1)) - 1,
    }));
}

// localStorage events tracking
export function trackEvent(quizId, event, data = {}) {
    try {
        const key = `analytics_${quizId}`;
        const stored = JSON.parse(localStorage.getItem(key) || '{"events":[]}');
        stored.events.push({ event, data, ts: Date.now() });
        localStorage.setItem(key, JSON.stringify(stored));
    } catch (_) { }
}
