import Foundation

/// The five fields scripts/build-widget-cards.ts writes. JSONDecoder ignores unknown
/// keys, so adding a field to the generator will not break an older widget build.
struct Card: Decodable {
    let id: String
    let domain: String
    let title: String
    let body: String
    let difficulty: Int
}

enum CardLoader {
    /// Cards ship inside the extension bundle, so the widget reads no network and never
    /// touches the app's database. An unreadable file yields an empty array, and the
    /// caller renders an empty state rather than crashing the extension.
    ///
    /// Two lookups because the config plugin links `assets/` as target resources, and
    /// whether Xcode flattens that directory or preserves it as a folder reference
    /// decides which name resolves. The plugin only declares explicit folder references
    /// for subdirectories of `assets/`, and `assets/` itself holds a file, so
    /// `cards.json` lands flat in the appex root and the first lookup is the one that
    /// resolves. The second lookup stays as insurance: trying both costs nothing and
    /// the alternative is a silently empty widget.
    static func load() -> [Card] {
        let url = Bundle.main.url(forResource: "cards", withExtension: "json")
            ?? Bundle.main.url(forResource: "assets/cards", withExtension: "json")
        guard let url,
              let data = try? Data(contentsOf: url),
              let cards = try? JSONDecoder().decode([Card].self, from: data)
        else { return [] }
        return cards
    }
}

/// The app's vocabulary, repeated here because the extension cannot import TypeScript.
/// These must stay in step with DOMAIN_LABELS_SHORT and LEVEL_LABELS in src/constants.ts.
enum Labels {
    static func domain(_ value: String) -> String {
        switch value {
        case "cs": return "CS"
        case "finance": return "Finance"
        case "math": return "Math"
        case "science": return "Science"
        default: return value
        }
    }

    /// Falls back to "Undergrad" out of range, matching difficultyLabel in src/format.ts.
    static func level(_ value: Int) -> String {
        switch value {
        case 1: return "High school"
        case 3: return "Graduate+"
        default: return "Undergrad"
        }
    }
}
