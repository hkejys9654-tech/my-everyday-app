import SwiftUI
import WebKit
import HealthKit

@main
struct EverydayCheckupApp: App {
    var body: some Scene { WindowGroup { CheckupView() } }
}

struct CheckupView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "health")
        if let url = Bundle.main.url(forResource: "health-bridge", withExtension: "js"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            context.coordinator.documentURL = url
            view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "health", contentWorld: .page)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
        var documentURL: URL?
        let health = HealthReader()
        var busy = false

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(action.request.url?.standardizedFileURL == documentURL?.standardizedFileURL ? .allow : .cancel)
        }

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage,
                                   replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.request.url?.standardizedFileURL == documentURL?.standardizedFileURL,
                  let body = message.body as? [String: String], body["action"] == "readWorkouts",
                  !busy else { replyHandler(nil, "요청을 처리할 수 없습니다."); return }
            busy = true
            Task { @MainActor in
                defer { busy = false }
                do { replyHandler(try await health.readWorkouts(), nil) }
                catch { replyHandler(nil, "건강 데이터를 가져오지 못했습니다. 건강 데이터 접근 설정을 확인하고 다시 시도해주세요.") }
            }
        }
    }
}

final class HealthReader {
    let store = HKHealthStore()
    let energy = HKQuantityType(.activeEnergyBurned)
    let heart = HKQuantityType(.heartRate)
    let distances = [HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling), HKQuantityType(.distanceSwimming)]

    func readWorkouts() async throws -> [[String: Any]] {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw NSError(domain: "HealthUnavailable", code: 1)
        }
        var types: Set<HKObjectType> = [HKObjectType.workoutType(), energy, heart]
        distances.forEach { types.insert($0) }
        try await store.requestAuthorization(toShare: [], read: types)
        let since = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
        let workouts: [HKWorkout] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: .workoutType(),
                predicate: HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate),
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(returning: samples as? [HKWorkout] ?? []) }
                }
            store.execute(query)
        }
        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.calendar = Calendar(identifier: .gregorian)
        dateFormatter.timeZone = .current
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let iso = ISO8601DateFormatter()
        return workouts.map { workout in
            var result: [String: Any] = [
                "id": workout.uuid.uuidString, "date": dateFormatter.string(from: workout.startDate),
                "name": name(workout.workoutActivityType), "durationMinutes": workout.duration / 60,
                "start": iso.string(from: workout.startDate), "end": iso.string(from: workout.endDate)
            ]
            result["calories"] = workout.statistics(for: energy)?.sumQuantity()?.doubleValue(for: .kilocalorie())
            let distance = distances.compactMap { workout.statistics(for: $0)?.sumQuantity()?.doubleValue(for: .meter()) }.reduce(0, +)
            if distance > 0 { result["distanceKm"] = distance / 1000 }
            let bpm = HKUnit.count().unitDivided(by: .minute())
            result["averageHeartRate"] = workout.statistics(for: heart)?.averageQuantity()?.doubleValue(for: bpm)
            result["maxHeartRate"] = workout.statistics(for: heart)?.maximumQuantity()?.doubleValue(for: bpm)
            return result
        }
    }

    func name(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "달리기"
        case .walking: return "걷기"
        case .cycling: return "사이클"
        case .swimming: return "수영"
        case .traditionalStrengthTraining: return "근력 운동"
        case .functionalStrengthTraining: return "기능성 근력 운동"
        case .highIntensityIntervalTraining: return "인터벌 운동"
        case .yoga: return "요가"
        case .hiking: return "하이킹"
        default: return "기타 운동"
        }
    }
}
