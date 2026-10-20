import SwiftUI

struct Recipe: Identifiable, Hashable {
    let id = UUID()
    var name: String
    var minutes: Int
    var vegetarian: Bool
}

@Observable
class Cookbook {
    var recipes = [
        Recipe(name: "Pancakes", minutes: 20, vegetarian: true),
        Recipe(name: "Chili", minutes: 45, vegetarian: false),
        Recipe(name: "Salad", minutes: 10, vegetarian: true)
    ]
}

struct ContentView: View {
    @State private var book = Cookbook()
    @State private var showAdd = false
    @State private var query = ""

    var filtered: [Recipe] {
        query.isEmpty ? book.recipes : book.recipes.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Recipes") {
                    ForEach(filtered) { recipe in
                        NavigationLink(value: recipe) {
                            Label(recipe.name, systemImage: recipe.vegetarian ? "leaf" : "flame")
                        }
                    }
                    .onDelete { offsets in
                        book.recipes.remove(atOffsets: offsets)
                    }
                }
                Section {
                    Text("\(book.recipes.count) recipes")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Cookbook")
            .navigationDestination(for: Recipe.self) { recipe in
                VStack(spacing: 12) {
                    Text(recipe.name).font(.title)
                    Text("\(recipe.minutes) minutes")
                }
                .navigationTitle(recipe.name)
            }
            .searchable(text: $query)
            .toolbar {
                Button("Add", systemImage: "plus") { showAdd = true }
            }
            .sheet(isPresented: $showAdd) {
                Text("New recipe form")
                    .font(.headline)
            }
        }
    }
}

#Preview {
    ContentView()
}
