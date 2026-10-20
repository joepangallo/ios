import SwiftUI

struct ContentView: View {
    @State private var count = 0
    @State private var name = ""
    @State private var notify = true

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "star.fill")
                .font(.system(size: 48))
                .foregroundStyle(.yellow)
            Text("Count: \(count)")
                .font(.largeTitle)
                .bold()
            HStack {
                Button("Minus") { count -= 1 }
                    .buttonStyle(.bordered)
                Button("Add one") { count += 1 }
                    .buttonStyle(.borderedProminent)
            }
            TextField("Your name", text: $name)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
            Text(name.isEmpty ? "Type your name" : "Hello, \(name)!")
                .foregroundStyle(.secondary)
            Toggle("Notifications", isOn: $notify)
                .padding(.horizontal)
            Text("Glass")
                .padding()
                .glassEffect()
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
