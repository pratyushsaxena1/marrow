import SwiftUI
import WidgetKit

struct PlaceholderEntry: TimelineEntry {
    let date: Date
}

struct PlaceholderProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlaceholderEntry {
        PlaceholderEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (PlaceholderEntry) -> Void) {
        completion(PlaceholderEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlaceholderEntry>) -> Void) {
        completion(Timeline(entries: [PlaceholderEntry(date: Date())], policy: .never))
    }
}

struct PlaceholderView: View {
    var body: some View {
        Text("Marrow")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
    }
}

@main
struct MarrowWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MarrowWidget", provider: PlaceholderProvider()) { _ in
            PlaceholderView()
        }
        .configurationDisplayName("Marrow")
        .description("A concept from your library, new each day.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
