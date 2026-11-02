// Lesson83Tests.swift
// Who: the Swift Testing runner.
// What: checks that lesson 8.3's five decoding programs print exactly the
//       output the course lists, that the course's Try It predictions hold, and
//       that the decoder lab names each DecodingError correctly.
// Where: the NetworkLabTests target.
// When: only when tests run.
// Why: the course page shows expected output for these programs; the app must
//      produce exactly the same lines.

import Testing // @Test, #expect and #require.
import Foundation // JSONDecoder and Data.
@testable import NetworkLab // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct Lesson83Tests { // REST Resources and JSON.
    @Test func decodeYourFirstResponsePrintsTheCourseOutput() throws { // expect: 'delectus aut autem\nStill to do'
        #expect(try FirstDecodeExample.run() == ["delectus aut autem", "Still to do"]) // Line for line.
    }

    @Test func renameKeysWithCodingKeysPrintsTheCourseOutput() throws { // expect: '25.7 °C, wind 18.8 km/h\nMeasured at 2026-10-20T14:15'
        #expect(try CodingKeysExample.run() == ["25.7 °C, wind 18.8 km/h", "Measured at 2026-10-20T14:15"]) // Line for line.
    }

    @Test func nestedJSONPrintsTheCourseOutput() throws { // expect: 'Leanne Graham lives on Kulas Light\nin Gwenborough'
        #expect(try NestedExample.run() == ["Leanne Graham lives on Kulas Light", "in Gwenborough"]) // Line for line.
    }

    @Test func flattenWithANestedContainerPrintsTheCourseOutput() throws { // expect: 'Leanne Graham, Gwenborough'
        #expect(try FlattenExample.run() == ["Leanne Graham, Gwenborough"]) // One line.
    }

    @Test func whenDecodingFailsPrintsTheCourseOutput() { // expect: four lines, one per call.
        #expect(DecodingFailureExample.run() == ["Decoded: Walk the dog", "Missing key: title", "Wrong type at [\"id\"]: expected Int", "Not valid JSON"]) // Line for line.
    }

    @Test func tryItNullTitleReachesTheFinalCatch() { // The course's Try It: check("{\"id\": 5, \"title\": null}").
        var out = Transcript() // Collects the line.
        DecodingFailureExample.check("{\"id\": 5, \"title\": null}", into: &out) // A null title is valueNotFound.
        #expect(out.lines == ["Not valid JSON"]) // Neither specific clause matches it.
    }

    @Test func extraKeysAreIgnored() throws { // Try It: add "priority": 2.
        let json = #"{"userId": 1, "id": 1, "title": "t", "completed": false, "priority": 2}"# // One key the model lacks.
        let todo = try JSONDecoder().decode(Todo.self, from: Data(json.utf8)) // Still decodes.
        #expect(todo.title == "t") // The modelled keys are read.
    }

    @Test func aStringWhereABoolBelongsIsATypeMismatch() { // Try It: "completed": "no".
        let json = #"{"userId": 1, "id": 1, "title": "t", "completed": "no"}"# // A string, not a Bool.
        #expect(DecoderLab.decode(json, titleIsOptional: false).hasPrefix("typeMismatch: expected Bool at [\"completed\"]")) // Named precisely.
    }

    @Test func nestedModelsDecodeTheFullUserReply() throws { // The live button's path, with a larger reply.
        let json = #"{"id": 1, "name": "Leanne Graham", "username": "Bret", "address": {"street": "Kulas Light", "suite": "Apt. 556", "city": "Gwenborough", "zipcode": "92998-3874"}, "phone": "1-770"}"# // Many extra keys.
        #expect(try NestedExample.describe(Data(json.utf8)) == ["Leanne Graham lives on Kulas Light", "in Gwenborough"]) // Same two lines.
        let user = try JSONDecoder().decode(PlaceholderUser.self, from: Data(json.utf8)) // The app's shared user model.
        #expect(user.address.city == "Gwenborough") // Nested property.
    }

    @Test func decoderLabNamesEveryOutcome() { // The lab, edit by edit.
        let required: (DecoderLab.Edit) -> String = { DecoderLab.decode($0.json, titleIsOptional: false) } // let title: String
        let optional: (DecoderLab.Edit) -> String = { DecoderLab.decode($0.json, titleIsOptional: true) } // let title: String?
        #expect(required(DecoderLab.Edit.original) == "Decoded: id 1, title \"delectus aut autem\", completed false") // Success.
        #expect(required(.missingKey).hasPrefix("keyNotFound: \"title\" at []")) // Missing key at the top level.
        #expect(optional(.missingKey) == "Decoded: id 1, title nil, completed false") // Optional: missing becomes nil.
        #expect(required(.quotedNumber).hasPrefix("typeMismatch: expected Int at [\"id\"]")) // A quoted number is a string.
        #expect(required(.nullValue).hasPrefix("valueNotFound: expected String at [\"title\"]")) // null for a non-optional.
        #expect(optional(.nullValue) == "Decoded: id 1, title nil, completed false") // Optional: null becomes nil.
        #expect(required(.array).hasPrefix("typeMismatch")) // An array where an object belongs.
        #expect(required(.truncated) == "dataCorrupted at []. The text is not valid JSON.") // Not JSON at all.
    }
}
