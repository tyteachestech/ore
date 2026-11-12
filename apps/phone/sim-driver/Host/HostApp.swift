import SwiftUI

// An empty app: a UI test bundle needs a host target. The driver drives Ore, not this.
@main
struct HostApp: App {
  var body: some Scene { WindowGroup { Text("Ore sim driver") } }
}
