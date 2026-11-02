// TrailPhoto.swift
// Who: lesson 7.5's "Load straight into your own type" demo, and its unit tests.
// What: the course's TrailPhoto, a type that conforms to Transferable so the photo
//       picker can hand back a finished value, and the course's load(_:) helper.
// Where: the Models folder.
// When: whenever the student picks a photo in that demo.
// Why: teaching your own type to be Transferable keeps decoding and error handling in
//      one place instead of repeating them in every view that loads photos.

import SwiftUI // Transferable, DataRepresentation and UIImage.
import PhotosUI // PhotosPickerItem.

/// A picked trail photo, decoded and ready to show.
/// `nonisolated` lets the system create it off the main actor, which Transferable needs;
/// this app otherwise isolates every type to the main actor by default.
nonisolated struct TrailPhoto: Transferable { // Can be created from transferred data.
    let image: UIImage // The decoded picture; it knows its pixel size.

    static var transferRepresentation: some TransferRepresentation { // The formats TrailPhoto can come from.
        DataRepresentation(importedContentType: .image) { data in // Any image file, handed over as Data.
            try decode(data) // The course's decoding, moved into a function tests can call.
        }
    }

    /// The course's import closure body: decode the bytes, or throw.
    static func decode(_ data: Data) throws -> TrailPhoto { // Shared by the closure above and the tests.
        guard let image = UIImage(data: data) else { // Not a valid picture.
            throw CocoaError(.fileReadCorruptFile) // A standard Foundation error.
        }
        return TrailPhoto(image: image) // A ready-to-use value.
    }

    /// The photo's size in pixels, such as "4032 x 3024 pixels".
    var pixelSizeText: String { // UIImage reports points times scale.
        let width = Int(image.size.width * image.scale) // Pixels across.
        let height = Int(image.size.height * image.scale) // Pixels down.
        return "\(width) x \(height) pixels" // Plain text for the screen.
    }
}

/// The course's helper: load a picked item straight into a TrailPhoto, or nil.
func load(_ item: PhotosPickerItem) async -> TrailPhoto? { // Called from a .task after a pick.
    try? await item.loadTransferable(type: TrailPhoto.self) // Runs TrailPhoto's import; errors become nil.
}
