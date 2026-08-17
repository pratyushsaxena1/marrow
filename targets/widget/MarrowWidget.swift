import SwiftUI
import WidgetKit

private let appGroup = "group.com.pratyushs123.marrow"
// #0a0a0a, the app's background. Named so it cannot collide with View.background(_:)
// when referenced from inside the View extension at the bottom of this file.
private let marrowInk = Color(red: 0.039, green: 0.039, blue: 0.039)

struct CardEntry: TimelineEntry {
    let date: Date
    let card: Card?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> CardEntry {
        CardEntry(date: Date(), card: CardLoader.load().first)
    }

    func getSnapshot(in context: Context, completion: @escaping (CardEntry) -> Void) {
        completion(entry(for: Date()))
    }

    /// A week of entries, one per local midnight. The widget keeps rotating even if the
    /// app is never opened again and the system never wakes the extension, so there is
    /// no background work and no refresh budget to manage.
    func getTimeline(in context: Context, completion: @escaping (Timeline<CardEntry>) -> Void) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let cards = CardLoader.load()
        let prefs = Preferences.load(appGroup: appGroup)
        let entries = (0 ..< 7).compactMap { offset -> CardEntry? in
            guard let date = calendar.date(byAdding: .day, value: offset, to: today) else {
                return nil
            }
            let day = DailyCard.dayIndex(for: date, calendar: calendar)
            return CardEntry(date: date, card: DailyCard.card(on: day, from: cards, prefs: prefs))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(for date: Date) -> CardEntry {
        let day = DailyCard.dayIndex(for: date)
        let card = DailyCard.card(
            on: day,
            from: CardLoader.load(),
            prefs: Preferences.load(appGroup: appGroup)
        )
        return CardEntry(date: date, card: card)
    }
}

struct MarrowWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CardEntry

    var body: some View {
        Group {
            if let card = entry.card {
                content(card)
            } else {
                Text("Open Marrow to get started")
                    .font(.system(size: 15))
                    .foregroundStyle(Color(white: 0.62))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(entry.card.flatMap { URL(string: "marrow:///card/\($0.id)") })
        .marrowBackground()
    }

    private func content(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(Labels.domain(card.domain)) \u{00B7} \(Labels.level(card.difficulty))".uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Color(white: 0.45))
                .lineLimit(1)

            Text(card.title)
                .font(.system(size: titleSize, weight: .semibold))
                .foregroundStyle(Color(white: 0.95))
                .lineLimit(titleLines)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)

            if let text = bodyText(card) {
                Text(text)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(white: 0.68))
                    .lineLimit(bodyLines)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
    }

    private var titleSize: CGFloat { family == .systemLarge ? 22 : 16 }

    /// The small family has no body text, so the title gets the room instead.
    private var titleLines: Int { family == .systemSmall ? 4 : 2 }

    private var bodyLines: Int { family == .systemLarge ? 14 : 3 }

    private func bodyText(_ card: Card) -> String? {
        switch family {
        case .systemSmall: return nil
        case .systemLarge: return card.body
        default: return firstSentence(of: card.body)
        }
    }
}

/// The medium family has room for one sentence, and a sentence is a unit the reader can
/// finish. A character count truncation lands mid clause instead.
func firstSentence(of text: String) -> String {
    let cut = [". ", "? ", "! "]
        .compactMap { text.range(of: $0)?.lowerBound }
        .min()
    guard let cut else { return text }
    return String(text[text.startIndex ... cut])
}

private extension View {
    /// iOS 17 requires containerBackground or the widget renders incorrectly. 16.4 has
    /// no such API, so it paints and pads the background itself.
    @ViewBuilder
    func marrowBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(marrowInk, for: .widget)
        } else {
            padding(16).background(marrowInk)
        }
    }
}

@main
struct MarrowWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MarrowWidget", provider: Provider()) { entry in
            MarrowWidgetView(entry: entry)
        }
        .configurationDisplayName("Marrow")
        .description("A concept from your library, new each day.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
