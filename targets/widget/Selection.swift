import Foundation

/// Written by src/widget/preferences.ts. An empty array means every level, or every
/// subject, matching the app's own filter convention.
struct Preferences: Decodable {
    let levels: [Int]
    let domains: [String]

    static let all = Preferences(levels: [], domains: [])

    /// A missing, unreadable or unparseable value degrades to showing everything rather
    /// than to showing nothing, which is the same failure direction the app takes.
    static func load(appGroup: String) -> Preferences {
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "preferences"),
              let data = raw.data(using: .utf8),
              let parsed = try? JSONDecoder().decode(Preferences.self, from: data)
        else { return .all }
        return parsed
    }
}

enum DailyCard {
    /// Candidate strides, all prime. A prime that does not divide the pool size is
    /// coprime with it, which makes the sequence visit every card exactly once before
    /// repeating. Hashing the date instead would start repeating within about three
    /// weeks.
    private static let candidateStrides = [97, 89, 83, 79, 73, 71, 67, 61, 59, 53,
                                           47, 43, 41, 37, 31, 29, 23, 19, 17, 13,
                                           11, 7, 5, 3, 2]

    /// Named `strideLength` rather than `stride` so it cannot be confused with Swift's
    /// global `stride(from:to:by:)` at the call site.
    static func strideLength(for count: Int) -> Int {
        candidateStrides.first { $0 < count && count % $0 != 0 } ?? 1
    }

    /// A day number that increments at local midnight. Deliberately local rather than
    /// UTC: a fact of the day that flips in the middle of the afternoon would be the
    /// most visible thing about the widget. See the design doc for why this is a scoped
    /// exception to the repo's UTC rule. Using ordinality rather than dividing a local
    /// startOfDay by 86400 avoids repeating or skipping a day across a DST change.
    static func dayIndex(for date: Date, calendar: Calendar = .current) -> Int {
        calendar.ordinality(of: .day, in: .era, for: date) ?? 0
    }

    static func pool(_ cards: [Card], _ prefs: Preferences) -> [Card] {
        let filtered = cards.filter { card in
            (prefs.levels.isEmpty || prefs.levels.contains(card.difficulty))
                && (prefs.domains.isEmpty || prefs.domains.contains(card.domain))
        }
        // An empty result means corrupt preferences, never a real choice: the app
        // normalizes "everything deselected" to the empty array. Fall back to the whole
        // corpus rather than showing an empty widget.
        return (filtered.isEmpty ? cards : filtered).sorted { $0.id < $1.id }
    }

    static func card(on day: Int, from cards: [Card], prefs: Preferences) -> Card? {
        let candidates = pool(cards, prefs)
        guard !candidates.isEmpty else { return nil }
        // Reducing day before multiplying keeps the product small. It is equivalent:
        // (day * s) % n == ((day % n) * s) % n.
        let index = ((day % candidates.count) * strideLength(for: candidates.count)) % candidates.count
        return candidates[index]
    }
}
