//
//  NutiWidget.swift
//  NutiWidget
//
//  iOS Widget using WidgetKit
//

import WidgetKit
import SwiftUI
import Intents

struct NutiWidgetEntry: TimelineEntry {
    let date: Date
    let calories: Int
    let caloriesGoal: Int
    let protein: Int
    let proteinGoal: Int
    let carbs: Int
    let carbsGoal: Int
    let fat: Int
    let fatGoal: Int
    let water: Int
    let waterGoal: Int
}

struct NutiWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> NutiWidgetEntry {
        NutiWidgetEntry(
            date: Date(),
            calories: 1200,
            caloriesGoal: 2000,
            protein: 80,
            proteinGoal: 150,
            carbs: 150,
            carbsGoal: 200,
            fat: 40,
            fatGoal: 65,
            water: 1200,
            waterGoal: 2700
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NutiWidgetEntry) -> ()) {
        let entry = loadWidgetData()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = loadWidgetData()
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }

    private func loadWidgetData() -> NutiWidgetEntry {
        // Load data from UserDefaults shared via App Group
        let sharedDefaults = UserDefaults(suiteName: "group.com.nuti.app")
        
        let calories = sharedDefaults?.integer(forKey: "calories") ?? 0
        let caloriesGoal = sharedDefaults?.integer(forKey: "caloriesGoal") ?? 2000
        let protein = sharedDefaults?.integer(forKey: "protein") ?? 0
        let proteinGoal = sharedDefaults?.integer(forKey: "proteinGoal") ?? 150
        let carbs = sharedDefaults?.integer(forKey: "carbs") ?? 0
        let carbsGoal = sharedDefaults?.integer(forKey: "carbsGoal") ?? 200
        let fat = sharedDefaults?.integer(forKey: "fat") ?? 0
        let fatGoal = sharedDefaults?.integer(forKey: "fatGoal") ?? 65
        let water = sharedDefaults?.integer(forKey: "water") ?? 0
        let waterGoal = sharedDefaults?.integer(forKey: "waterGoal") ?? 2700

        return NutiWidgetEntry(
            date: Date(),
            calories: calories,
            caloriesGoal: caloriesGoal,
            protein: protein,
            proteinGoal: proteinGoal,
            carbs: carbs,
            carbsGoal: carbsGoal,
            fat: fat,
            fatGoal: fatGoal,
            water: water,
            waterGoal: waterGoal
        )
    }
}

struct NutiWidgetEntryView: View {
    var entry: NutiWidgetProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            MediumWidgetView(entry: entry)
        }
    }
}

struct SmallWidgetView: View {
    var entry: NutiWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Nuti")
                .font(.headline)
                .foregroundColor(Color(red: 0.23, green: 0.70, blue: 0.45)) // #3BB273
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Calories")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                HStack {
                    Text("\(entry.calories)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(Color(red: 0.23, green: 0.70, blue: 0.45))
                    
                    Text("/ \(entry.caloriesGoal) kcal")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                ProgressView(value: Double(entry.calories), total: Double(entry.caloriesGoal))
                    .tint(Color(red: 0.23, green: 0.70, blue: 0.45))
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MediumWidgetView: View {
    var entry: NutiWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nuti")
                .font(.headline)
                .foregroundColor(Color(red: 0.23, green: 0.70, blue: 0.45))
            
            // Calories
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Calories")
                        .font(.subheadline)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    Text("\(entry.calories)")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(Color(red: 0.23, green: 0.70, blue: 0.45))
                    
                    Text("/ \(entry.caloriesGoal) kcal")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                ProgressView(value: Double(entry.calories), total: Double(entry.caloriesGoal))
                    .tint(Color(red: 0.23, green: 0.70, blue: 0.45))
            }
            
            // Macros
            HStack(spacing: 12) {
                MacroView(
                    name: "Protein",
                    value: entry.protein,
                    goal: entry.proteinGoal,
                    unit: "g"
                )
                
                MacroView(
                    name: "Carbs",
                    value: entry.carbs,
                    goal: entry.carbsGoal,
                    unit: "g"
                )
                
                MacroView(
                    name: "Fat",
                    value: entry.fat,
                    goal: entry.fatGoal,
                    unit: "g"
                )
                
                MacroView(
                    name: "Water",
                    value: entry.water,
                    goal: entry.waterGoal,
                    unit: "ml"
                )
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MacroView: View {
    let name: String
    let value: Int
    let goal: Int
    let unit: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(name)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Text("\(value)\(unit)")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color(red: 0.23, green: 0.70, blue: 0.45))
            
            Text("/ \(goal)\(unit)")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            ProgressView(value: Double(value), total: Double(goal))
                .tint(Color(red: 0.23, green: 0.70, blue: 0.45))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@main
struct NutiWidget: Widget {
    let kind: String = "NutiWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NutiWidgetProvider()) { entry in
            NutiWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Nuti")
        .description("Track your daily calories and macros")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    NutiWidget()
} timeline: {
    NutiWidgetEntry(
        date: Date(),
        calories: 1200,
        caloriesGoal: 2000,
        protein: 80,
        proteinGoal: 150,
        carbs: 150,
        carbsGoal: 200,
        fat: 40,
        fatGoal: 65,
        water: 1200,
        waterGoal: 2700
    )
}



