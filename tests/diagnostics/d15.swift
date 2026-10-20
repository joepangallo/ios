enum Light { case red, yellow, green }
let l = Light.red
switch l {
case .red: print("stop")
case .green: print("go")
}
