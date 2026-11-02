// PlaceholderModels.swift
// Who: the lessons that decode JSONPlaceholder replies, and the unit tests.
// What: Swift types that mirror the practice API's JSON: a to-do, a post,
//       a comment and a user with a nested address.
// Where: the Models folder; URLSession code decodes into these types.
// When: whenever a reply from jsonplaceholder.typicode.com is decoded.
// Why: Codable matches each stored property to the JSON key with the same name,
//      so declaring the shape once is all the decoding code you need (Lesson 8.3).

import Foundation // Codable lives in the Swift standard library; Foundation brings JSONDecoder.

/// One to-do, exactly as GET /todos/1 returns it.
struct Todo: Codable, Sendable, Identifiable, Hashable { // Identifiable lets SwiftUI lists use id; Hashable lets tests compare.
    let userId: Int // The JSON key "userId": which user owns the to-do.
    let id: Int // The JSON key "id": the to-do's own identifier.
    let title: String // The JSON key "title": the text of the to-do.
    let completed: Bool // The JSON key "completed": true or false.
}

/// One post, as GET /posts returns them.
struct Post: Codable, Sendable, Identifiable, Hashable { // Same idea as Todo, for the posts collection.
    let userId: Int // Which user wrote the post.
    let id: Int // The post's identifier.
    let title: String // The headline.
    let body: String // The text, with line breaks.
}

/// A user, with only the keys the lessons use. Extra keys in the JSON are ignored.
struct PlaceholderUser: Codable, Sendable, Identifiable, Hashable { // Named PlaceholderUser so it never clashes with the lesson examples.
    let id: Int // The user's identifier.
    let name: String // For example "Leanne Graham".
    let address: Address // A nested JSON object becomes a nested struct.

    /// The nested "address" object inside a user.
    struct Address: Codable, Sendable, Hashable { // Declared inside, because it only makes sense with a user.
        let street: String // For example "Kulas Light".
        let city: String // For example "Gwenborough".
    }
}
